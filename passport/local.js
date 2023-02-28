const passport = require('passport');
const { Strategy:LocalStrategy } = require('passport-local');
const { User } = require('../models');
const bcrypt = require('bcrypt');

// 아이디 검사
// start logIn course #4 -> 성공시 routes/user.js callback
module.exports = () => {
    passport.use(new LocalStrategy({
        usernameField: 'email',
        passwordField: 'password',  // 1. req.body에 대한 설정
    }, async (email, password, done) => {
        try{
            const user = await User.findOne({ // 2. 이메일 있는지 검사
                where: { email }
            });
            if (!user) {    // 3. 이메일 없을 시
                //done( server error, success, client error(보내는측에서 잘못보낼때) )
                return done(null, false, { reason: '존재하지 않는 사용자입니다!'}); // 클라이언트 실패
            }
            // 4. 이메일 존재시 비밀번호 비교.
            const result = await bcrypt.compare(password, user.password);
            if ( result ) {
                // 5. 비밀번호 일치 done, user 반환 ( 성공 )
                return done(null, user);
            }
            // 6. 비밀번호 에러
            return done(null, false, { reason: '비밀번호가 틀렸습니다.' }); // 클라이언트 실패
        } catch (error) {
            // 서버에러는 이곳으로
            console.error(error);
            return done(error);
        }

    }));
};