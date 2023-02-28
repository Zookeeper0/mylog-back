const DataTypes = require('sequelize');
const { Model } = DataTypes;

// class식 최신화
module.exports = class Comment extends Model {
    //sequelize.define => init
    static init(sequelize) {
        return super.init({
            // id가 기본적으로 들어있다.
            content: {
                type: DataTypes.TEXT,
                allowNull: false,
            },
            // UserId: 1
            // PostId: 3
        }, {
            modelName: 'Comment',
            tableName: 'comments',
            charset: 'utf8mb4',
            collate: 'utf8mb4_general_ci', // 이모티콘 저장
            sequelize,
        });
    }
    static associate(db) {
        db.Comment.belongsTo(db.User);
        db.Comment.belongsTo(db.Post);
    }
};

// (sequelize, DataTypes) => {
//     const Comment = sequelize.define('Comment', {
//         // id가 기본적으로 들어있다.
//         content: {
//             type: DataTypes.TEXT,
//             allowNull: false,
//         },
//         // UserId: 1
//         // PostId: 3
//     }, {
//         charset: 'utf8mb4',
//         collate: 'utf8mb4_general_ci',
//     });
//     Comment.associate = (db) => {
//         db.Comment.belongsTo(db.User);
//         db.Comment.belongsTo(db.Post);
//     };
//     return Comment;
// }