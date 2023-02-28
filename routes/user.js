const express = require('express');
const bcrypt = require('bcrypt');
const { User, Post, Comment, Image } = require('../models');
const passport = require('passport');
const { isLoggedIn, isNotLoggedIn } = require('./middlewares');
const logout = require('express-passport-logout');
const {Op} = require("sequelize");

const router = express.Router();

// 새로고침시 로그인정보 매번 불러오기 ( 로그인 풀림 방지 )
router.get('/', async (req, res, next) => {   // GET /user
    try {
        if (req.user) {
            const fullUserWithoutPassword = await User.findOne({
                where: { id: req.user.id },
                attributes: {
                    exclude: ['password']
                },
                include: [{
                    model: Post,
                    attributes: ['id'],
                }, {
                    model: User,
                    as: 'Followings',
                    attributes: ['id'],
                }, {
                    model: User,
                    as: 'Followers',
                    attributes: ['id'],
                }]
            })
            console.log("fullUserWithoutPassword: ", fullUserWithoutPassword)
            res.status(200).json(fullUserWithoutPassword);
        } else {
            res.status(200).json(null);
        }
    } catch (error) {
        console.error(error);
        next(error);
    }
});

// 프로필에서 팔로워 불러오기
router.get('/followers', async (req, res, next) => { // GET /user/followers
    try {
        const user = await User.findOne({ where: { id: req.user.id }});
        if (!user) {
            res.status(403).send('없는 사람을 찾으려고 하시네요?');
        }
        const followers = await user.getFollowers({
            limit: parseInt(req.query.limit, 10),
        });
        res.status(200).json(followers);
    } catch (error) {
        console.error(error);
        next(error);
    }
});

// 프로필에서 팔로잉 불러오기
router.get('/followings', async (req, res, next) => { // GET /user/followings
    try {
        const user = await User.findOne({ where: { id: req.user.id }});
        if (!user) {
            res.status(403).send('없는 사람을 찾으려고 하시네요?');
        }
        const followings = await user.getFollowings({
            limit: parseInt(req.query.limit, 10),
        });
        res.status(200).json(followings);
    } catch (error) {
        console.error(error);
        next(error);
    }
});

// userId가 followings||follower로 착각 가능 so wildcard 왠만하면 아래로
router.get('/:userId', async (req, res, next) => { // GET /user/3
    try {
        const fullUserWithoutPassword = await User.findOne({
            where: { id: req.params.userId },
            attributes: {
                exclude: ['password']
            },
            include: [{
                model: Post,
                attributes: ['id'],
            }, {
                model: User,
                as: 'Followings',
                attributes: ['id'],
            }, {
                model: User,
                as: 'Followers',
                attributes: ['id'],
            }]
        })
        if (fullUserWithoutPassword) {
            const data = fullUserWithoutPassword.toJSON();
            data.Posts = data.Posts.length; // 개인정보 침해 예방
            data.Followings = data.Followings.length;
            data.Followers = data.Followers.length;
            res.status(200).json(data);
        } else {
            res.status(404).json('존재하지 않는 사용자입니다.');
        }
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.get('/:userId/posts', async (req, res, next) => {   // GET /user/1/posts
    try {
        const where = { UserId: req.params.userId };
        if (parseInt(req.query.lastId, 10)) { // 초기 로딩이 아닐 때
            where.id = { [Op.lt]: parseInt(req.query.lastId, 10)}   // [Op.lt] 시퀄라이즈 문법 ~보다작은거 불러오기
        } // 21 20 ... 3 2 1
        const posts = await Post.findAll({
            where,
            limit: 10,
            order: [
                ['createdAt', 'DESC'],
                [Comment, 'createdAt', 'DESC'],
            ],
            include: [{
                model: User,
                attributes: ['id', 'nickname'],
            }, {
                model: Image,
            }, {
                model: Comment,
                include: [{
                    model: User,
                    attributes: ['id', 'nickname'],
                }],
            }, {
                model: User, // 좋아요 누른 사람
                as: 'Likers',
                attributes: ['id'],
            }, {
                model: Post,
                as: 'Retweet',
                include: [{
                    model: User,
                    attributes: ['id', 'nickname'],
                }, {
                    model: Image,
                }],
            }],
        });
        console.log(posts);
        res.status(200).json(posts);
    } catch (error) {
        console.error(error);
        next(error);
    }
});

// Router이나 app에 붙는 애들이 보통 다 미들웨어이다
// 미들웨어 확장 passport.authenticate으로 인해 (req,res,next)쓸자리가 없어 확장 ( express 기법 중 하나 )
// start logIn course #3 -> passport/local.js
// start logIn course #5 callback  return -> passport/index.js serializerUser
router.post('/login', (req, res, next) => {
    passport.authenticate('local', (err, user, info) => {
        if (err) {
            console.log(err);
            return next(err);
        }
        if ( info ) {
            return res.status(401).send(info.reason);
        }
        return req.login(user, async (loginErr) => {    // 우리서비스 로그인 다통과후 한번더 패스포트 로그인 부분
            if (loginErr) {
                console.error(loginErr);
                return next(loginErr);
            }
            //시퀄라이즈가 다른테이블들과의 관계를 자동으로 합쳐서 보내준다 ( attributes로 원하는것만 골라올 수 도있음 )
            const fullUserWithoutPassword = await User.findOne({
                where: { id: user.id },
                attributes: {
                    exclude: ['password']
                },
                include: [{
                    model: Post,
                    attributes: ['id'],
                }, {
                    model: User,
                    as: 'Followings',
                    attributes: ['id'],
                }, {
                    model: User,
                    as: 'Followers',
                    attributes: ['id'],
                }]
            })
            return res.status(200).json(fullUserWithoutPassword);
        });
    })(req,res,next);
});

//회원가입
// start signUp course #5
//req <- from saga/user.js signUpAPI data
router.post('/', isNotLoggedIn, async (req, res, next) => { //POST /user
    // isNotLoggedIn을 사용하는 이유 아래처럼 바로 코딩해도 되지만 코드의 중복발생 -> middlewares.js를 통한 중복처리
    // if (!req.isAuthenticated()) {
    //     next(); // next()에 인자가없다면 다음 미들웨어로!
    // } else {
    //     res.status(401).send('로그인하지 않은 사용자만 접근 가능합니다.');
    // }
    try{
        // 중복회원 검사
        const exUser = await User.findOne({
            where: {
                email: req.body.email,
            }
        });
        if (exUser) {
            return res.status(403).send("already use email.") // return 안쓰면 밑에코드까지 그대로 실행되고 res 응답 두번 보내져 error 발생( 응답은 무조건 1번 )
        }
        //bcrypt도 비동기라 await 붙여줌
        const hashedPassword = await bcrypt.hash(req.body.password, 10); //보통 10~13 넣음
        await User.create({
            email : req.body.email,
            nickname:  req.body.nickname,
            password: hashedPassword,
        });
        res.status(200).send('ok');
    } catch (error) {
        console.log(error);
        next(error); //status 500
    }
});

router.post('/logout', (req, res) => {
    logout();
    req.session.destroy();
    res.send('ok')
});

//닉네임 수정
router.patch('/nickname', async (req, res, next) => {
    try {
        await User.update({
            nickname: req.body.nickname,
        }, {
            where: { id: req.user.id },
        });
        res.status(200).json({ nickname: req.body.nickname });
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.patch('/:userId/follow', isLoggedIn, async (req, res, next) => { // PATCH /user/1/follow
    try {
        const user = await User.findOne({ where: { id: req.params.userId }});
        if (!user) {
            res.status(403).send('없는 사람을 팔로우하려고 하시네요?');
        }
        await user.addFollowers(req.user.id);
        res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.delete('/:userId/follow', isLoggedIn, async (req, res, next) => { // DELETE /user/1/follow
    try {
        const user = await User.findOne({ where: { id: req.params.userId }});
        if (!user) {
            res.status(403).send('없는 사람을 언팔로우하려고 하시네요?');
        }
        await user.removeFollowers(req.user.id);
        res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.delete('/:userId/follow', isLoggedIn, async (req, res, next) => { // DELETE /user/1/follow
    try {
        const user = await User.findOne({ where: { id: req.params.userId }});
        if (!user) {
            res.status(403).send('없는 사람을 언팔로우하려고 하시네요?');
        }
        await user.removeFollowers(req.user.id);
        res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
    } catch (error) {
        console.error(error);
        next(error);
    }
});
// 팔로워 삭제하기
router.delete('/follower/:userId', isLoggedIn, async (req, res, next) => { // DELETE /user/follower/2
    try {
        const user = await User.findOne({ where: { id: req.params.userId }});
        if (!user) {
            res.status(403).send('없는 사람을 차단하려고 하시네요?');
        }
        await user.removeFollowings(req.user.id);
        res.status(200).json({ UserId: parseInt(req.params.userId, 10) });
    } catch (error) {
        console.error(error);
        next(error);
    }
});

module.exports = router;