//jshint esversion:6
require('dotenv').config();
const express = require("express");
const http = require('http');
const ejs = require("ejs");
const bodyParser = require("body-parser");

const Chat = require("./Model/chat");
const User = require("./Model/user");

const session = require("express-session");
const passport = require("passport");
const GoogleStrategy = require('passport-google-oauth20').Strategy;

const alert = require('alert');

const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
app.set('view engine', 'ejs');

app.use(session({
    secret: "Our Little secret",
    resave: false,
    saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());

passport.use(User.createStrategy());

passport.serializeUser(function (user, done) {
    done(null, user);
});

passport.deserializeUser(function (user, done) {
    done(null, user);
});

passport.use(new GoogleStrategy({
    clientID: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    callbackURL: "http://localhost:3000/auth/google/Chat",
    // userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo"
},
    function (accessToken, refreshToken, profile, cb) {
        // console.log(accessToken);
        // console.log(profile);
        // console.log(profile._json);
        const newUser = new User({
            googleId: profile.id,
            profilePic: profile.photos[0].value,
            fullName: profile.displayName
        });
        User.findOne({ googleId: profile.id }, function (err, user) {
            if (!err) {

                if (!user) {
                    newUser.save();
                }
            }
            else {
                console.log(err);
            }
            return cb(err, user);
        });
    }
));

app.get("/", function (req, res) {
    res.render("home");
});

app.get("/auth/google",
    passport.authenticate("google", { scope: ["profile"] })
);

app.get('/auth/google/Chat',
    passport.authenticate('google', { failureRedirect: '/login' }),
    function (req, res) {
        // Successful authentication, redirect home.
        res.redirect("/dashboard");
    });


app.get("/login", function (req, res) {
    if (req.isAuthenticated()) {
        res.redirect("/dashboard");
    }
    else {
        res.render("login");
    }
});
app.get("/register", function (req, res) {
    res.render("register");
});

const io = new Server(server);
let roomId = 0;
io.on('connection', (socket) => {

    socket.on('global-chat', (msg) => {
        socket.join('global');
        if (msg.value === '-100001-') {
            Chat.find({ roomId: 'global' }, function (err, foundChats) {
                if (err) {
                    console.log(err);
                }
                else {
                    for (i = 0; i < foundChats.length; i++) {
                        socket.emit('global-message', foundChats[i]);
                    }
                }
            })
        }
        let data = {
            username: msg.username,
            type: "join"
        }
        io.emit('displayTyping', data);

    });

    socket.on('global-message', function (msg) {
        io.sockets.in('global').emit('global-message', msg);
        if (msg.value != null) {
            const newMsg = new Chat({
                fromId: msg.fromId,
                roomId: 'global',
                value: msg.value,
                username: msg.username
            });
            newMsg.save();
        }

    });
    socket.on('private-chat', (msg) => {

        var a = parseInt(msg.fromId, 10);
        var b = parseInt(msg.toId, 10);
        roomId = a + b;
        socket.join(roomId);
        if (msg.value === '-100001-') {
            Chat.find({ roomId: roomId }, function (err, foundChats) {
                if (err) {
                    console.log(err);
                }
                else {
                    for (i = 0; i < foundChats.length; i++) {
                        socket.emit('chat-message', foundChats[i]);
                    }
                }
            })
        }

    });
    socket.on('chat-message', function (msg) {
        io.sockets.in(roomId).emit('chat-message', msg);
        if (msg.value != null) {
            const newMsg = new Chat({
                fromId: msg.fromId,
                toId: msg.toId,
                roomId: roomId,
                value: msg.value,
                username: msg.username
            });
            newMsg.save();
        }
    });

    socket.on('typing', (data) => {
        if (data.typing == true) {
            io.emit('displayTyping', data);
        }
        else {
            data.username = "";
            io.emit('displayTyping', data)
        }
    })
    socket.on('disconnect', () => {
        console.log("User Disconnected");
    });
});

app.get("/dashboard", function (req, res) {
    if (req.isAuthenticated()) {

        // console.log(req.session.passport.user);
        //set activeStatus as Online
        User.findOneAndUpdate({ googleId: req.user.googleId }, { $set: { activeStatus: true } }, function (err) {
            if (err) {
                console.log(err);
            }
            else {
                console.log("User Is Online");
            }
        });

        //show user Friends

        let friends = req.user.friends;
        let userChats=[];
        if (friends.length === 0) {
            res.render("dashboard", { Chats: friends, user: req.user });
        }
        else {
            User.find({ googleId: { $ne: req.user.googleId } }, function (err, foundChats) {

                let promise = new Promise((res, rej) => {
                    
                    for (var i = 0; i < foundChats.length; i++) {
                        if (friends.indexOf(foundChats[i].googleId) !== -1) {
                            userChats.push(foundChats[i]);
                        }
                    }

                    res();
                });
                if (err) {
                    console.log(err);
                }
                
                if (foundChats) {
                    promise.then(() => {
                    res.render("dashboard", { Chats: userChats, user: req.user });

                    })
                }
            });
        }
    }
    else {
        res.render("login");
    }
});

app.get("/findFriends", function (req, res) {
    if (req.isAuthenticated()) {

        var friends = [];
        friends = req.user.friends;
        let nonFriends=[];

        User.find({ googleId: { $ne: req.user.googleId } }, function (err, foundUsers) {

            let promise = new Promise((res, rej) => {
                for (var i = 0; i < foundUsers.length; i++) {
                    if (friends.indexOf(foundUsers[i].googleId) === -1) {
                        nonFriends.push(foundUsers[i]);
                    }
                }
                res();
            });
            if (err) {
                console.log(err);
            }
            
            if (foundUsers) {
                promise.then(() => {
                res.render("findFriends", { Users: nonFriends, user: req.user });

                })
            }
            else{
                res.redirect("/dashboard");
            }
        });
    }
    else {
        res.redirect("/login");
    }
});

app.get("/global", function (req, res) {
    if (req.isAuthenticated()) {
        res.render("global", { user: req.user });
    }
    else {
        res.redirect("/login");
    }
})
app.get("/addFriend/:googleId", function (req, res) {
    if (req.isAuthenticated()) {

        if (!(req.user.friends.indexOf(req.params.googleId) > -1)) {
            User.findOneAndUpdate({ googleId: req.user.googleId }, { $push: { friends: req.params.googleId } }, function (err) {
                if (err) {
                    console.log(err);
                }
                else {
                    req.session.passport.user.friends.push(req.params.googleId);
                    req.session.save(function (err) {
                        console.log('Updated User Session');
                    })
                    alert('You Both Are Now Friends');
                    // User.find({ googleId: req.params.googleId }, function (err, foundUser) {
                    //     if (err) {
                    //         console.log(err);
                    //     }
                    //     else {
                    //         let userFriends=foundUser.friends;
                    //         if(userFriends.indexOf(req.user.googleId)===-1){
                    //             User.findOneAndUpdate({googleId:req.params.googleId},{$push:{friends:req.user.googleId}},function(){
                    //                 if(err){
                    //                     console.log(err);
                    //                 }
                    //                 else{
                    //                     console.log("User Friends Updated");
                    //                 }
                    //             })
                    //         }
                    //     }
                    // });
                }
            });
        }
        else {
            alert("You both are friends already");
        }
        res.redirect("/findFriends");
    }
    else {
        res.redirect("/login");
    }
});


app.post("/register", function (req, res) {

    const newuser = new User({
        username: req.body.username,
        password: req.body.password,
        profilePic: req.body.fullName[0],
        fullName: req.body.fullName
    })
    User.register(newuser, req.body.password, function (err, user) {
        if (err) {
            console.log(err);
            res.redirect("/register");
        }
        else {
            passport.authenticate("local")(req, res, function () {
                res.redirect("/dashboard");
            })
        }
    })

});

app.post("/login", function (req, res) {
    const user = new User({
        username: req.body.username,
        password: req.body.password
    });
    req.login(user, function (err) {
        if (err) {
            console.log(err);
        }
        else {
            passport.authenticate("local")(req, res, function () {
                res.render("dashboard", { Chats: chats, userName: req.user.userName, imgLink: req.user.profilePic });
            });
        }
    })
});

app.get('/logout', function (req, res, next) {

    User.findOneAndUpdate({ googleId: req.user.googleId }, { $set: { activeStatus: false } }, function (err) {
        if (err) {
            console.log(err);
        }
        else {
            console.log("User Is Offline");
        }
    });
    req.logout(function (err) {
        if (err) { return next(err); }
        res.redirect('/');
    });
});

server.listen(process.env.PORT||3000, function () {
    console.log("Server Started On Port 3000");
});