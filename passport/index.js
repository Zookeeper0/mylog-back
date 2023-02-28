const passport = require('passport');
const local = require('./local');
const { User } = require('../models');

module.exports = () => {
    // start logIn course #6 session 무거워지는거 방지, id만 저장 ->
    passport.serializeUser((user, done) => {
        done(null, user.id);
    });

    // cookie 오면 id 복구
    passport.deserializeUser(async (id, done) => {
        try{
            const user = await User.findOne({ where: { id }});
            done(null, user);
        } catch (error) {
            console.log(error);
            done(error);
        }
    });

    local();
};