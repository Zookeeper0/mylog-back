const express = require('express');
const cors = require('cors');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const passport = require('passport');
const dotenv = require('dotenv');
const morgan = require('morgan');
const path = require('path');
const hpp = require('hpp');
const helmet = require('helmet');

const postsRouter = require('./routes/posts');
const postRouter = require('./routes/post');
const userRouter = require('./routes/user');
const hashtagRouter = require('./routes/hashtag');
const db = require('./models');
const passportConfig = require('./passport');

dotenv.config();
const app = express();
//서버 실행시 디비 시퀄라이즈 연결도 같이하는 코드
db.sequelize.sync()
    .then(() => {
        console.log('db 연결 성공');
    })
    .catch(console.error);

passportConfig();

if (process.env.NODE_ENV === 'production') {
    app.use(morgan('combined'));
    app.use(hpp());
    app.use(helmet());
    app.use(cors({
        origin: true,
        credentials: true,
    }));
} else {
    app.use(morgan('dev'));
    app.use(cors({
        origin: true,
        credentials: true,
    }));
}
// 브라우저에서 온 요청 모두 허락
app.use(cors({
    origin: ['http://localhost:3001', 'eastzoo.co.kr'],
    credentials: true, //다른 도메인 간의 쿠키전달
}));

//static 미들웨어 설정
app.use('/', express.static(path.join(__dirname, 'uploads')));

//front에서 보내준 데이터를 req.body 안에 넣어주는 역할!!!
app.use(express.json());  //front에서 json형식 파일 req.body안에 넣어줌
app.use(express.urlencoded({ extended: true})); //front에서 form submit형식 파일 req.body안에 넣어줌
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(session({
    saveUninitialized: false,
    resave: false,
    secret: process.env.COOKIE_SECRET,
    cookie: {
        httpOnly: true,
        secure: false,
        domain: process.env.NODE_ENV === 'production' && '.eastzoo.co.kr'
    }
}));
app.use(passport.initialize());
app.use(passport.session());


app.get('/', (req, res) => {
    res.send('welcome eastZoo Server!!')
});

app.use('/posts', postsRouter);
app.use('/post', postRouter);
app.use('/user', userRouter);
app.use('/hashtag', hashtagRouter);

app.listen(3065, () => {
    console.log('서버 실행 중!!');
});