const mongoose = require("mongoose");
require('dotenv').config();
const express=require('express');

const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const session = require("express-session");
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const app = express();
const url = "mongodb+srv://" + process.env.USER_NAME + ":" + process.env.ADMIN_PASSWORD + "@cluster0.ixadnkb.mongodb.net/chatDB?retryWrites=true&w=majority";
// const url = "mongodb://0.0.0.0:27017/mainDB";
mongoose.connect(url, ({
    useNewUrlParser: true,
    useUnifiedTopology: true
}), function (err) {
    if (err) console.log(err)
    else console.log("UserDB is connected");
});

// mongoose.connect("mongodb://localhost:27017/DB",{useNewUrlParser:true});
const userSchema = new mongoose.Schema({
    username: String,
    password: String,
    googleId: String,
    profilePic: String,
    fullName: String,
    friends:Array,
    activeStatus:Boolean,
    rating:Number
});

userSchema.plugin(passportLocalMongoose);
const User = mongoose.model("user", userSchema);


module.exports = User;