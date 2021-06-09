const express = require('express')
const path = require('path')

const app = express()
app.use(express.static("public"));
app.use(express.urlencoded({extended: true}));
app.set("view engine", "pug");

const boardSize = 42;

const winningCombinations = [
	[0,1,2,3],[41,40,39,38],[7,8,9,10],[34,33,32,31],
	[14,15,16,17],[27,26,5,24],[21,22,23,24],[20,19,18,17],
	[28,29,30,31],[13,12,11,10],[35,36,37,38],[6,5,4,3],[0,7,14,21],
	[41,34,27,20],[1,8,15,22],[40,33,26,19],[2,9,16,23],[39,32,25,18],
	[3,10,17,24],[38,31,24,17],[4,11,18,25],[37,30,23,16],[5,12,19,26],
	[36,29,22,15],[6,13,20,27],[35,28,21,14],[0,8,16,24],[41,33,25,17],
	[7,15,23,31],[34,26,18,10],[14,22,30,38],[27,19,11,3],[35,29,23,17],
	[6,12,18,24],[28,22,16,10],[13,19,25,31],[21,15,9,3],[20,26,32,38],
	[36,30,24,18],[5,11,17,23],[37,31,25,19],[4,10,16,22],[2,10,18,26],
	[39,31,23,15],[1,9,17,25],[40,32,24,16],[9,7,25,33],[8,16,24,32],
	[11,7,23,29],[12,18,24,30],[1,2,3,4],[5,4,3,2],[8,9,10,11],[12,11,10,9],
	[15,16,17,18],[19,18,17,16],[22,23,24,25],[26,25,24,23],[29,30,31,32],
	[33,32,31,30],[36,37,38,39],[40,39,38,37],[7,17,21,28],[8,15,22,29],
	[9,16,23,30],[10,17,24,31],[11,18,25,32],[12,19,26,33],[13,20,27,34]
]

var users = [
	{username: "Bob", password: 123, wins: 2, losses: 1, draws: 0, status: "offline", profile: "public", inGameID: false, currentPlayer: false, friends:[], sent_requests:[], received_requests:["Joe"]},
	{username: "Joe", password: 321, wins: 1, losses: 2, draws: 0, status: "offline", profile: "public", inGameID: false, currentPlayer: false, friends:[], sent_requests:["Bob"], received_requests:[]}
];

var games = [
    {id: 1000, player1: "Bob", player2: "Joe", winner: "Bob", movesTotal: 4, privacy: "public", active: false, waiting: false, forfeit: true, board: []},
    {id: 1001, player1: "Bob", player2: "Joe", winner: "Joe", movesTotal: 6, privacy: "public", active: false, waiting: false, forfeit: false, board: []},
    {id: 1002, player1: "Bob", player2: "Joe", winner: "Bob", movesTotal: 8, privacy: "public", active: false, waiting: false, forfeit: false, board: []}
]
let nextID = 1003;
let finishedGamesCount = 3;

const session = require('express-session');
const { ppid } = require('process');
const { finished } = require('stream');
app.use(session({
	cookie: {
		maxAge: 360000000 //in milliseconds (360 000 000ms = 100hrs)
	},
	secret: 'thisisencrypted' //encryption key for security
}))

app.use('/', function(req, res, next) {
	console.log(req.session);
	next();
})

app.get("/", getLoginPage);
app.get("/search", getSearchPage);
app.get("/friends", getFriendsPage);
app.get("/main", getMainPage);
app.get("/play", getPlayPage);
app.get("/register", getRegisterPage);
app.get("/users/:user", getProfilePage);
app.get("/logOutUser", logOut);
app.get("/games/:gameID", getGamePage);
app.get("/findGame/:privacy", findGame)

app.post("/loginUser", login)
app.post("/registerUser", signUp, login)
app.post("/searchUser", getUsers)
app.post("/sendRequest/:username", sendFriendRequest)
app.post("/removeFriend/:username", removeAsFriend)
app.post("/setPrivacy/:level", setUserPrivacy)
app.post("/acceptRequest/:username", acceptFriendRequest)
app.post("/declineRequest/:username", declineFriendRequest)
app.post("/makeMove/:gameID", makeMove)
app.post("/updateGame/:gameID", updateGamePage)

function getLoginPage(req, res) {
	res.status(200).render("login_page", {session: req.session});
}
function getSearchPage(req, res) {
	res.status(200).render("search_page", {session: req.session});
}
function getMainPage(req, res) {
	res.status(200).render("main_page", {session: req.session});
}
function getPlayPage(req, res) {
	res.status(200).render("play_page", {session: req.session});
}
function getRegisterPage(req, res) {
	res.status(200).render("register_page", {session: req.session});
}

function getFriendsPage(req, res) {
	let userFriends = [];
	let friendRequests = [];
	let currentUser = getUserFromUsername(req.session.username);

	for(i=0;i<currentUser.friends.length;i++) {
		userFriends.push(getUserFromUsername(currentUser.friends[i]));
	}
	for(i=0;i<currentUser.received_requests.length;i++) {
		friendRequests.push(getUserFromUsername(currentUser.received_requests[i]));
	}
	
	res.status(200).render("friends_page", {friends: userFriends, requests: friendRequests, session: req.session});
}

function getProfilePage(req, res) {
	let showAddFriend = true;
	let showSetPriv = false;
	let showRemoveBtn = false;
	let aUser = getUserFromUsername(req.params.user);
	let recentGames = getLast5Games(aUser.username);

	if(aUser.username == req.session.username) { //if client is viewing their own profile
		showAddFriend = false;
		showSetPriv = true;
	}
	else{
		for(i=0;i<aUser.friends.length;i++) {
			if(aUser.friends[i] == req.session.username) {
				showAddFriend = false;
				showRemoveBtn = true;
				break;
			}
		}
	}
	if(showAddFriend) {
		res.status(200).render("profile_page", {user: aUser, showReqBtn: true, games: recentGames, percent: calculateWinPercentage(req.session.username), session: req.session});
	}
	else if(showRemoveBtn) {
		res.status(200).render("profile_page", {user: aUser, showRemoveBtn: true, games: recentGames, percent: calculateWinPercentage(req.session.username), session: req.session});
	}
	else if(showSetPriv) {
		res.status(200).render("profile_page", {user: aUser, showPrivBtn: true, games: recentGames, percent: calculateWinPercentage(req.session.username), session: req.session});
	}
	else {
		res.status(200).render("profile_page", {user: aUser, games: recentGames, percent: calculateWinPercentage(req.session.username), session: req.session});
	}
}

function getGamePage(req, res) {
	console.log("Display Game function called");
	console.log("Displaying Game: " + req.params.gameID);
	console.log("-----");

	let game = getGameFromID(req.params.gameID);
	if(game.active) {
		if(game.currentPlayer == 1) {
			res.status(200).render("game_page", {board: game.board, player: game.player1, game: game, active: true, session: req.session})
		}
		else {
			res.status(200).render("game_page", {board: game.board, player: game.player2, game: game, active: true, session: req.session})
		}
	}
	else {
		res.status(200).render("game_page", {board: game.board, game: game, active: false, session: req.session})
	}
}

function doesUserExist(user) {
	for(i=0; i < users.length; i++) {
		if(users[i].username == user.username) {
			return true;
		}
	}
	return false;
}

function login(req, res) {
	console.log("login function called");
	console.log("-----");

	if(req.session.loggedIn) {
		console.log("User is already logged in");
		console.log("-----");
		res.status(401).render("redirect", {session: req.session});
	}

	else {
		let user = req.body;
		let usernameFound = false;

		for(i=0; i < users.length; i++) {
			if(users[i].username == user.username) {
				usernameFound = true;
				console.log("Username is correct");
				console.log("-----");

				if(users[i].password == user.password) {
					console.log("Password is correct - User logged in");
					console.log("-----");
					
					users[i].status = "online";
					req.session.username = user.username;
					req.session.loggedIn = true;
					res.status(200).redirect(`/users/${users[i].username}`);
				}

				else {
					console.log("Password is incorrect");
					console.log("-----");
					res.render("login_page", {incorrect: "password"});
				}
			}
		}
		if(!usernameFound) {
			console.log("Username is incorrect");
			console.log("-----");
			res.render("login_page", {incorrect: "username"});
		}
	}
}

function signUp(req, res, next) {
	console.log("signUp function called");
	console.log("-----");

	let user = req.body;

	if(req.session.loggedIn) {
		console.log("User is already logged in");
		console.log("-----");
		res.status(401).render("redirect", {session: req.session});
	}
	else if(doesUserExist(user)) {
		res.status(406).send("That username already exists")
	}
	else {
		user.wins = 0;
		user.losses = 0;
		user.draws = 0;
		user.status = "online";
		user.profile = "public";
		user.inGameID = false;
		user.friends = [];
		user.sent_requests = [];
		user.received_requests = [];
		users.push(user);

		console.log("New User:")
		console.log(user)
		console.log("-----")

		next();
	}
}

function logOut(req, res) {
	let currentUser = getUserFromUsername(req.session.username);
	currentUser.status = "offline";
	req.session.destroy();
	res.redirect('/');
}

function getUsers(req, res) {
	let foundUsers = [];
	let keyword = req.body.keyword;

	console.log("Username must have: " + keyword);

    for(i=0; i<users.length; i++) {
		let currentUsername = users[i].username.toUpperCase();
		if(users[i].profile == "public") {
			if(!(currentUsername == req.session.username.toUpperCase())) { //do not show the current client's own username
				if(keyword == "") {
					foundUsers.push(users[i]);
				}
				else {
					if(currentUsername.includes(keyword.toUpperCase())) {
						foundUsers.push(users[i]);
					}
				}
			}
		}
    }
	res.render('search_page', {users: foundUsers, session: req.session});
}

function sendFriendRequest(req, res) {
	let sentUser = getUserFromUsername(req.params.username);
	let currentUser = getUserFromUsername(req.session.username);
	let alreadySent = false;
	let areFriends = false;

	console.log("Sent user: " + sentUser.username);
	console.log("Current user: " + currentUser.username);

	for(i=0;i<currentUser.sent_requests.length;i++) {
		if(currentUser.sent_requests[i] == sentUser.username) {
			alreadySent = true;
		}
	}

	if(alreadySent) {
		var message = "Already sent a friend request to this user!"
	}
	else {
		var message = "Request sent!"
		//if the client has received a request from the user whom he is sending a friend request to, automatically make the two users friends
		for(i=0;i<currentUser.received_requests.length;i++) {
			if(currentUser.received_requests[i] == sentUser.username) {
				currentUser.friends.push(req.params.username);
				sentUser.friends.push(req.session.username);
				currentUser.received_requests.splice(i, 1);
				areFriends = true;

				for(j=0;j<sentUser.sent_requests.length;j++) {
					if(sentUser.sent_requests[j] == req.params.username) {
						sentUser.sent_requests.splice(j, 1);
						break;
					}
				}
				break;
			}
		}
		currentUser.sent_requests.push(sentUser.username);
		sentUser.received_requests.push(currentUser.username);
	}
	if(areFriends) {
		res.render("profile_page", {user: sentUser, showRemoveBtn: true, games: getLast5Games(sentUser.username), sent: message, percent: calculateWinPercentage(req.session.username), session: req.session});
	}
	else {
		res.render("profile_page", {user: sentUser, showReqBtn: true, games: getLast5Games(sentUser.username), sent: message, percent: calculateWinPercentage(req.session.username), session: req.session});
	}
}

function removeAsFriend(req, res) {
	let currentUser = getUserFromUsername(req.session.username);
	let removeUser = getUserFromUsername(req.params.username);

	for(i=0;i<currentUser.friends.length;i++) {
		if(currentUser.friends[i] == removeUser.username) {
			currentUser.friends.splice(i, 1);
			break;
		}
	}
	for(i=0;i<removeUser.friends.length;i++) {
		if(removeUser.friends[i] == currentUser.username) {
			removeUser.friends.splice(i, 1);
			break;
		}
	}
	res.render("profile_page", {user: removeUser, showReqBtn: true, games: getLast5Games(removeUser.username), percent: calculateWinPercentage(req.session.username), session: req.session});
}

function setUserPrivacy(req, res) {
	let currentUser = getUserFromUsername(req.session.username);
	currentUser.profile = req.params.level;
	res.status(200).redirect(`/users/${req.session.username}`);
}

function acceptFriendRequest(req, res) {
	let currentUser = getUserFromUsername(req.session.username);
	let requestingUser = getUserFromUsername(req.params.username);

	currentUser.friends.push(req.params.username);
	requestingUser.friends.push(req.session.username);

	for(i=0;i<currentUser.received_requests.length;i++) {
		if(currentUser.received_requests[i] == req.params.username) {
			currentUser.received_requests.splice(i, 1);
			break;
		}
	}
	for(i=0;i<requestingUser.sent_requests.length;i++) {
		if(requestingUser.sent_requests[i] == req.session.username) {
			requestingUser.sent_requests.splice(i, 1);
			break;
		}
	}
	res.redirect('/friends');
}

function declineFriendRequest(req, res) {
	let currentUser = getUserFromUsername(req.session.username);
	let requestingUser = getUserFromUsername(req.params.username);

	for(i=0;i<currentUser.received_requests.length;i++) {
		if(currentUser.received_requests[i] == req.params.username) {
			currentUser.received_requests.splice(i, 1);
			break;
		}
	}
	for(i=0;i<requestingUser.sent_requests.length;i++) {
		if(requestingUser.sent_requests[i] == req.session.username) {
			requestingUser.sent_requests.splice(i, 1);
			break;
		}
	}
	res.redirect('/friends');
}

function findGame(req, res) {
	console.log("Find Game function called");
	console.log("-----");

	let privacy = req.params.privacy;
	let gameFound = false;
	let ID = null;
	let currentUser = getUserFromUsername(req.session.username);

	if(currentUser.inGameID == false) {
		for(i=finishedGamesCount;i<games.length;i++) {
			if(games[i].player2 == "") {
				if(games[i].privacy == privacy) {
					ID = games[i].id;
					games[i].waiting = false;
					games[i].player2 = currentUser.username;
					currentUser.inGameID = ID;
					gameFound = true;
					break;
				}
			}
		}
		if(!gameFound) {
			let game = { id: nextID++}
			game.player1 = req.session.username;
			game.player2 = "";
			game.winner = "";
			game.movesTotal = 0;
			game.privacy = privacy;
			game.active = true;
			game.forfeit = false;
			game.waiting = true;
			game.currentPlayer = 1;
			game.board = [];

			for(i=0;i<boardSize;i++) {
				game.board[i] = 0;
			}
			
			games.push(game);
			ID = game.id;
			currentUser.inGameID = ID;
		}
		res.status(200).redirect('/games/' + ID);
	}
	else {
		res.redirect('/games/' + currentUser.inGameID);
	}
}

function makeMove(req, res) {
	let game = getGameFromID(req.params.gameID);
	let move = req.body.move;
	let validInput = /^\d+$/.test(move);
	let string = "";

	if(!validInput) {
		string = "Invalid Move. Must pick a NUMBER from 1 to 42";
		if(game.currentPlayer == 1) {
			res.status(200).render("game_page", {board: game.board, player: game.player1, invalid: true, message: string, game: game, active: true, session: req.session})
		}
		else {
			res.status(200).render("game_page", {board: game.board, player: game.player2,  invalid: true, message: string, game: game, active: true, session: req.session})
		}
	}
	else {
		var validMove = parseInt(move);
		if(validMove < 1 || validMove > 42) {
			string = "Invalid Move. Must pick a number from 1 to 42";
			if(game.currentPlayer == 1) {
				res.status(200).render("game_page", {board: game.board, player: game.player1, invalid: true, message: string, game: game, active: true, session: req.session})
			}
			else {
				res.status(200).render("game_page", {board: game.board, player: game.player2,  invalid: true, message: string, game: game, active: true, session: req.session})
			}
		}
		else if(validMove < 36) {
			if(game.board[validMove + 6] == 0) {
				string = "Invalid Move. You cannot go there yet! There must be a piece underneath";
				if(game.currentPlayer == 1) {
					res.status(200).render("game_page", {board: game.board, player: game.player1, invalid: true, message: string, game: game, active: true, session: req.session})
				}
				else {
					res.status(200).render("game_page", {board: game.board, player: game.player2,  invalid: true, message: string, game: game, active: true, session: req.session})
				}
			}
			else if(!game.board[validMove - 1] == 0) {
				string = "Invalid Move. That spot is taken!";
				if(game.currentPlayer == 1) {
					res.status(200).render("game_page", {board: game.board, player: game.player1, invalid: true, message: string, game: game, active: true, session: req.session})
				}
				else {
					res.status(200).render("game_page", {board: game.board, player: game.player2,  invalid: true, message: string, game: game, active: true, session: req.session})
				}
			}
			else {
				if(game.currentPlayer == 1) {
					game.movesTotal++;
					game.currentPlayer = 2;
					game.board[validMove - 1] = 1;
				}
				else {
					game.movesTotal++;
					game.currentPlayer = 1;
					game.board[validMove - 1] = 2;
				}
				checkWin(game.id);
				res.status(200).redirect(`/games/${req.params.gameID}`);
			}
		}
		else {
			if(!game.board[validMove - 1] == 0) {
				string = "Invalid Move. That spot is taken!";
				if(game.currentPlayer == 1) {
					res.status(200).render("game_page", {board: game.board, player: game.player1, invalid: true, message: string, game: game, active: true, session: req.session})
				}
				else {
					res.status(200).render("game_page", {board: game.board, player: game.player2,  invalid: true, message: string, game: game, active: true, session: req.session})
				}
			}
			else {
				if(game.currentPlayer == 1) {
					game.movesTotal++;
					game.currentPlayer = 2;
					game.board[validMove - 1] = 1;
				}
				else {
					game.movesTotal++;
					game.currentPlayer = 1;
					game.board[validMove - 1] = 2;
				}
				checkWin(game.id);
				res.status(200).redirect(`/games/${req.params.gameID}`);
			}
		}
	}
}

function updateGamePage(req, res) {
	res.status(200).redirect(`/games/${req.params.gameID}`);
}

//helper
function checkWin(id) {
	let game = getGameFromID(id);
	for(i=0;i<winningCombinations.length;i++) {
		let square1 = game.board[winningCombinations[i][0]]
		let square2 = game.board[winningCombinations[i][1]]
		let square3 = game.board[winningCombinations[i][2]]
		let square4 = game.board[winningCombinations[i][3]]

		if(square1 == 1 && square2 == 1 && square3 == 1 && square4 == 1) { 
			game.winner = game.player1;
			game.active = false;
			finishedGamesCount++;
			break;
		}
		else if(square1 == 2 && square2 == 2 && square3 == 2 && square4 == 2) { 
			game.winner = game.player2;
			game.active = false;
			finishedGamesCount++;
			break;
		}
	}
}

//helper
function getLast5Games(username) {
	let foundGames = [];

	for(i=0;i<games.length;i++) {
		if(games[i].active == false) {
			if(games[i].player1 == username || games[i].player2 == username) {
				foundGames.push(games[i]);
			}
		}
	}
	return foundGames;
}

//helper
function getUserFromUsername(username) {
	for(i=0;i<users.length;i++) {
		if(users[i].username == username) {
			return users[i];
		}
	}
}

//helper
function getGameFromID(id) {
	for(i=0;i<games.length;i++) {
		if(games[i].id == id) {
			return games[i];
		}
	}
}

//helper
function calculateWinPercentage(username) {
	let user = getUserFromUsername(username);
	let percentage = (user.wins / (user.wins + user.losses + user.draws)) * 100;
	return percentage.toFixed(2);
}

app.listen(3000);
console.log("Server listening at http://localhost:3000");