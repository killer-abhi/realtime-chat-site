const mongoose = require("mongoose");
require('dotenv').config();
const url = "mongodb+srv://" + process.env.USER_NAME + ":" + process.env.ADMIN_PASSWORD + "@cluster0.ixadnkb.mongodb.net/chatDB?retryWrites=true&w=majority";
// const url = "mongodb://0.0.0.0:27017/mainDB";
mongoose.createConnection(url, ({
    useNewUrlParser: true,
    useUnifiedTopology: true
}), function (err) {
    if (err) console.log(err)
    else console.log("ChatDB is connected");
});

let chatSchema = mongoose.Schema({
   fromId:String,
   toId:String,
   roomId:String,
   value:String,
   username:String
});
const Chat = mongoose.model('chat', chatSchema);

module.exports = Chat;