const express = require('express');
// multer는 app.js에 장착할 수 도있지만 보통 route에 장착 form마다 데이터 형식이나 타입들이 다르기때문에(app은모든 라우터 공통)
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const { isLoggedIn, isNotLoggedIn } = require('./middlewares');
const { Post, Image, Comment, User, Hashtag } = require('../models');

const router = express.Router();

try {
    fs.accessSync('uploads');
} catch (error) {
    console.log('uploads 폴더가 없으므로 생성합니다.');
    fs.mkdirSync('uploads');
}

const upload = multer({
    storage: multer.diskStorage({
        destination(req, file, done) {
            done(null, 'uploads');
        },
        filename(req, file, done) { // 제로초.png
            const ext = path.extname(file.originalname); // 확장자 추출(.png)
            const basename = path.basename(file.originalname, ext); // eastzoo
            done(null, basename + '_' + new Date().getTime() + ext); // eastzoo15184712891.png / 날짜를 추가해서 저장함으로써 파일이름 같아도 구별
        },
    }),
    limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
});

// start Post course #4 -> sagas/post.js addPost
router.post('/', isLoggedIn, upload.none(), async (req, res, next) => { //POST /post
    try {
        const hashtags = req.body.content.match(/#[^\s#]+/g);
        const post = await Post.create({
            content: req.body.content,
            UserId: req.user.id,    // 로그인한 상황 deserializUser덕분에 id로 정보가져올 수 있음
        });
        if (hashtags) {
            const result = await Promise.all(hashtags.map((tag) => Hashtag.findOrCreate({
                where: { name: tag.slice(1).toLowerCase() },
            }))); // result의 결과물 -> [[노드, true], [리액트, true]]
            await post.addHashtags(result.map((v) => v[0])); // 위배열에서 결과물만 추출 [0]
        }
        if (req.body.image) {
            if (Array.isArray(req.body.image)) { // 이미지를 여러 개 올리면 image: [east.png, zoo.png]
                const images = await Promise.all(req.body.image.map((image) => Image.create({ src: image })));
                await post.addImages(images);
            } else { // 이미지를 하나만 올리면 image: eastzoo.png 배열 ㄴㄴ
                const image = await Image.create({ src: req.body.image });
                await post.addImages(image);
            }
        }
        const fullPost = await Post.findOne({
            where: { id: post.id },
            include: [{
                model: Image,
            }, {
                model: Comment,
                include: [{
                    model: User, // 댓글 작성자
                    attributes: ['id', 'nickname'],
                }],
            }, {
                model: User, // 게시글 작성자
                attributes: ['id', 'nickname'],
            }, {
                model: User, // 좋아요 누른 사람
                as: 'Likers',
                attributes: ['id'],
            }]
        })
        res.status(201).json(fullPost);
    } catch (error) {
        console.error(error);
        next(error);
    }
});
// 게시글 하나만 가져올때
router.get('/:postId', async (req, res, next) => { // POST /post/1/retweet
    try {
        const post = await Post.findOne({
            where: { id: req.params.postId },
        });
        if (!post) {
            return res.status(404).send('존재하지 않는 게시글입니다.');
        }
        const fullPost = await Post.findOne({
            where: { id: post.id },
            include: [{
                model: Post,
                as: 'Retweet',
                include: [{
                    model: User,
                    attributes: ['id', 'nickname'],
                }, {
                    model: Image,
                }]
            }, {
                model: User,
                attributes: ['id', 'nickname'],
            }, {
                model: User, // 좋아요 누른 사람
                as: 'Likers',
                attributes: ['id'],
            }, {
                model: Image,
            }, {
                model: Comment,
                include: [{
                    model: User,
                    attributes: ['id', 'nickname'],
                }],
            }],
        })
        res.status(200).json(fullPost);
    } catch (error) {
        console.error(error);
        next(error);
    }
});


// 한장만 올릴거면 upload.single
router.post('/images', upload.array('image'), async (req, res, next) => {  //Post /images
    console.log(req.files);
    res.json(req.files.map((v) => v.filename));
});

// 댓글 달기
router.post('/:postId/comment', isLoggedIn, async (req, res, next) => { //POST /post/1/comment
    try {
        //댓글달기전에 게시글 있는지 한번더 확인해주는 로직
        const post = await Post.findOne({
            where: {id: req.params.postId},
        });
        if (!post) {
            return res.status(403).send('존재하지 않는 게시글입니다.');
        }
        const comment = await Comment.create({
            content: req.body.content,
            PostId: parseInt(req.params.postId, 10),
            UserId: req.user.id,
        })
        const fullComment = await Comment.findOne({
            where: { id: comment.id },
            include: [{
                model: User,
                attributes: ['id', 'nickname'],
            }],
        })
        res.status(201).json(fullComment);
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.patch('/:postId/like', async (req, res, next) => { // PATCH /post/1/like
    try {
        const post = await Post.findOne({ where: { id: req.params.postId }});
        if (!post) {
            return res.status(403).send('게시글이 존재하지 않습니다.');
        }
        await post.addLikers(req.user.id);
        res.json({ PostId: post.id, UserId: req.user.id });
    } catch (error) {
        console.error(error);
        next(error);
    }
});

router.delete('/:postId/like', async (req, res, next) => { // DELETE /post/1/like
    try {
        const post = await Post.findOne({ where: { id: req.params.postId }});
        if (!post) {
            return res.status(403).send('게시글이 존재하지 않습니다.');
        }
        await post.removeLikers(req.user.id);
        res.json({ PostId: post.id, UserId: req.user.id });
    } catch (error) {
        console.error(error);
        next(error);
    }
});

// 게시글 제거
router.delete('/:postId', async (req, res, next) => { //DELETE /post
    try {
        await Post.destroy({
            where: {
                id: req.params.postId,
                UserId: req.user.id,
            },
        });
        // 처음에 params로 문자열로 아이디를 보내줘서 에러! int로 변환후 보내자
        res.status(200).json({ PostId: parseInt(req.params.postId, 10) });
    } catch (error) {
        console.log(error);
        next(error);
    }
});
// !!!!!! 어렵기때문에 잘 생각해보기
router.post('/:postId/retweet', async (req, res, next) => { // POST /post/1/retweet
    try {
        const post = await Post.findOne({
            where: { id: req.params.postId },
            include: [{
                model: Post,
                as: 'Retweet',
            }],
        });
        if (!post) {
            return res.status(403).send('존재하지 않는 게시글입니다.');
        }
        if (req.user.id === post.UserId || (post.Retweet && post.Retweet.UserId === req.user.id)) { // 자기 게시글을 리트윗하는경우 방지 || 리트윗된 자기 게시글을 자기가 다시 리트윗 방지
            return res.status(403).send('자신의 글은 리트윗할 수 없습니다.');
        }
        const retweetTargetId = post.RetweetId || post.id;
        const exPost = await Post.findOne({
            where: {
                UserId: req.user.id,
                RetweetId: retweetTargetId,
            },
        });
        if (exPost) {
            return res.status(403).send('이미 리트윗했습니다.');
        }
        const retweet = await Post.create({
            UserId: req.user.id,
            RetweetId: retweetTargetId,
            content: 'retweet',
        });
        const retweetWithPrevPost = await Post.findOne({
            where: { id: retweet.id },
            include: [{
                model: Post,
                as: 'Retweet',
                include: [{
                    model: User,
                    attributes: ['id', 'nickname'],
                }, {
                    model: Image,
                }]
            }, {
                model: User,
                attributes: ['id', 'nickname'],
            }, {
                model: User, // 좋아요 누른 사람
                as: 'Likers',
                attributes: ['id'],
            }, {
                model: Image,
            }, {
                model: Comment,
                include: [{
                    model: User,
                    attributes: ['id', 'nickname'],
                }],
            }],
        })
        res.status(201).json(retweetWithPrevPost);
    } catch (error) {
        console.error(error);
        next(error);
    }
});

module.exports = router;