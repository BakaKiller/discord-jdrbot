/**
 * Created by Baka Killer on 29/05/2017.
 */
const Discord = require('discord.js');
const client = new Discord.Client();
const letters = {
    a: 0,
    b: 1,
    c: 2,
    d: 3,
    e: 4,
    f: 5,
    g: 6,
    h: 7,
    i: 8,
    j: 9,
    k: 10,
    l: 11,
    m: 12,
    n: 13,
    o: 14,
    p: 15,
    q: 16,
    r: 17,
    s: 18,
    t: 19,
    u: 20,
    v: 21,
    w: 22,
    x: 23,
    y: 24,
    z: 25,
    aa: 26,
    ab: 27,
    ac: 28,
    ad: 29,
    ae: 30,
    af: 31,
    ag: 32,
    ah: 33,
    ai: 34,
    aj: 35,
    ak: 36
};

var fs = require('fs');
var opus = require('node-opus');
var readline = require('readline');
var google = require('googleapis');
var googleAuth = require('google-auth-library');
var mkdirp = require('mkdirp');

var voicechan = null;
var ongoinggame = null;
var gamedata;
var users = {};
var sheets = {};
var isgameon = false;
var dispatcher = null;

// If modifying these scopes, delete your previously saved credentials
// at ~/.credentials/sheets.googleapis.com-nodejs-quickstart.json
var SCOPES = ['https://www.googleapis.com/auth/spreadsheets.readonly'];
var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    process.env.USERPROFILE) + '\\.credentials\\';
var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';
console.log(TOKEN_PATH);
/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 * @param {function} callback The callback to call with the authorized client.
 */
function authorize(credentials, callback, character, chan) {
    var clientSecret = credentials.installed.client_secret;
    var clientId = credentials.installed.client_id;
    var redirectUrl = credentials.installed.redirect_uris[0];
    var auth = new googleAuth();
    var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

    // Check if we have previously stored a token.
    fs.readFile(TOKEN_PATH, function (err, token) {
        if (err) {
            getNewToken(oauth2Client, callback, character, chan);
        } else {
            oauth2Client.credentials = JSON.parse(token);
            callback(oauth2Client, character, chan);
        }
    });
}

/**
 * Get and store new token after prompting for user authorization, and then
 * execute the given callback with the authorized OAuth2 client.
 *
 * @param {google.auth.OAuth2} oauth2Client The OAuth2 client to get token for.
 * @param {getEventsCallback} callback The callback to call with the authorized
 *     client.
 */
function getNewToken(oauth2Client, callback, character, chan) {
    var authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question('Enter the code from that page here: ', function (code) {
        rl.close();
        oauth2Client.getToken(code, function (err, token) {
            if (err) {
                console.log('Error while trying to retrieve access token', err);
                return;
            }
            oauth2Client.credentials = token;
            storeToken(token);
            callback(oauth2Client, character, chan);
        });
    });
}

/**
 * Store token to disk be used in later program executions.
 *
 * @param {Object} token The token to store to disk.
 */
function storeToken(token) {
    try {
        fs.mkdirSync(TOKEN_DIR);
    } catch (err) {
        if (err.code != 'EEXIST') {
            throw err;
        }
    }
    fs.writeFile(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to ' + TOKEN_PATH);
}

function link_to(user, character, chan) {
    if (character in gamedata.characters) {
        users[user] = character;
        // Load client secrets from a local file.
        fs.readFile('client_secret.json', function processClientSecrets(err, content) {
            if (err) {
                console.log('Error loading client secret file: ' + err);
                return;
            }
            // Authorize a client with the loaded credentials, then call the
            // Google Sheets API.
            authorize(JSON.parse(content), get_sheet, character, chan);
        });
        return true;
    } else {
        return false
    }
}

function get_sheet(auth, character, chan) {
    var gsheets = google.sheets('v4');
    gsheets.spreadsheets.values.get({
        auth: auth,
        spreadsheetId: gamedata.characters[character],
        range: gamedata.range
    }, function (err, resp) {
        if (err) {
            console.log('ERROR ! - ' + err);
            return false;
        }
        set_sheet(character, resp.values, chan);
    })
}

function set_sheet(character, content, chan) {
    sheets[character] = content;
    chan.send(character + ' added.');
}

function prepare_game(game) {
    gamedata = JSON.parse(fs.readFileSync('./gamedata.json'));
    if (gamedata.hasOwnProperty(game)) {
        gamedata = gamedata[game];
        isgameon = true;
        ongoinggame = game;
        return true;
    }
    return false;
}

function get_char(user, char) {
    char = char.toLowerCase();
    if (char in gamedata.char && user in users) {
        var charpos = gamedata.char[char];
        charpos = charpos.split('!');
        return parseInt(sheets[users[user]][charpos[1] - 1][letters[charpos[0]]]);
    } else {
        console.log(char + "\n" + JSON.stringify(gamedata.char) + "\n\n");
        console.log(user + "\n" + JSON.stringify(users) + "\n\n");
        if (char in gamedata.char) {
            console.log('In char');
        }
        if (user in users) {
            console.log('in users');
        }
        return false;
    }
}

function roll(toroll) {
    var roll = toroll.split('d');
    var rollresult = '';
    for (var i = 0; i < roll[0]; i++) {
        if (i !== 0) {
            rollresult += ' - ';
        }
        rollresult += Math.floor(Math.random() * roll[1]) + 1;
    }
    return rollresult;
}

function loadgame(game, name, version, chan) {
    var path = 'saves/' + game + '/' + name + '/' + version + '/';
    if (fs.existsSync(path)) {
        gamedata = JSON.parse(fs.readFileSync(path + 'gamedata.json'));
        users = JSON.parse(fs.readFileSync(path + 'users.json'));
        ongoinggame = game;
        isgameon = true;
        for (var usr in users) {
            if (users.hasOwnProperty(usr)) {
                link_to(usr, users[usr], chan);
            }
        }
    } else {
        return "This save does not exist !";
    }
}

function get_number(name) {
    name = name.toLowerCase();
    var alphabet = ["a","b","c","d","e","f","g","h","i","j","k","l","m","n","o","p","q","r","s","t","u","v","w","x","y","z"];
    var sum = 0;
    for (var i = 0; i < name.length; i++) {
        sum += (alphabet.indexOf(name[i]) + 1);
    }
    sum = sum.toString().split('');
    var total = 1;
    for (i = 0; i < sum.length; i++) {
        total = total * (sum[i]);
    }

    if (total >= 50) {
        total = total / 2;
    }

    var rocknumbers = [7, 14, 21, 28, 35, 42, 49];
    var rocks = {
        7: 'Citrine',
        14: 'Héliodore',
        21: 'Apatite',
        28: 'Lapis-Lazuli',
        35: 'Garnet',
        42: 'Quartz',
        49: 'Morganite'
    };
    var cat = 0;
    for (i = 0; i < rocknumbers.length; i++) {
        if (total < rocknumbers[i]) {
            cat = rocknumbers[i];
            break;
        }
    }

    return rocks[cat];
}

function savegame(name, version) {
    if (isgameon && ongoinggame !== null && name !== null && version !== null) {
        var ok = true;
        var mess = "";

        mkdirp('saves/' + ongoinggame + '/' + name + '/' + version + '/', function (err) {
            if (err) {
                console.log(err);
                ok = false;
                mess += "Folders couldn't be created !\n";
            } else {
                fs.writeFile(
                    'saves/' + ongoinggame + '/' + name + '/' + version + '/users.json',
                    JSON.stringify(users),
                    function (err) {
                        if (err) {
                            console.log(err);
                            ok = false;
                            console.log('saves/' + ongoinggame + '/' + name + '/' + version + '/users.json');
                            mess += "Couldn't save users.json...\n";
                        } else {
                            mess += "Saved users.json...\n";
                        }
                    }
                );
                fs.writeFile(
                    'saves/' + ongoinggame + '/' + name + '/' + version + '/gamedata.json',
                    JSON.stringify(gamedata),
                    function (err) {
                        if (err) {
                            console.log(err);
                            ok = false;
                            mess += "Couldn't save gamedata.json...\n";
                        } else {
                            mess += "Saved gamedata.json...\n";
                        }
                    }
                );
            }
        });
        if (ok) {
            mess += "Everything was properly saved !";
        } else {
            mess += "There were errors during saving !";
        }
        return mess;
    } else {
        return "Nothing has been saved ! Is the game launched, and did you set your save correctly ?";
    }
}

function roll_char(user, chartocheck, sr) {
    if (sr === undefined) {
        sr = false;
    }
    chartocheck = chartocheck.toLowerCase();
    var char = get_char(user, chartocheck);
    var goal = get_system_val('goal');
    var action = get_system_val('action');
    var dicetoroll = get_system_val('dice');
    var rollresult = roll(dicetoroll);
    var result = "";
    if (get_system_val('multipledice')) {
        var rolldetails = rollresult;
        var method = get_system_val('method');
        rollresult = rollresult.split(' - ');
        var value = 0;
        switch (method) {
            case '+':
                for (var i = 0; i < rollresult.length; i++) {
                    value += rollresult[i];
                }
                break;
            case '-':
                value += rollresult[0];
                for (var i = 1; i < rollresult.length; i++) {
                    value -= rollresult[i];
                }
                break;
            case 'avg':
                var sum = 0;
                for (var i = 0; i < rollresult.length; i++) {
                    sum += rollresult[i];
                }
                value = sum / rollresult.length;
                break;
        }
        rollresult = value < 0 ? value * -1 : value;
    }
    switch (action) {
        case "comp":
            if (goal === "over") {
                result += (rollresult >= char) ? "Success !" : "Failure !";
                result += " You rolled a " + rollresult;
                result += get_system_val('multipledice') ? " (" + rolldetails + ")" : '';
                result += " over " + chartocheck + " (" + char + ")";
            } else if (goal === "sub") {
                result += (rollresult <= char) ? "Success !" : "Failure !";
                result += " You rolled a " + rollresult;
                result += get_system_val('multipledice') ? " (" + rolldetails + ")" : '';
                result += " under " + chartocheck + " (" + char + ")";
            }
            break;
        case "add":
            if (goal === "over" && sr !== false) {
                result += ((parseInt(rollresult) + parseInt(char)) >= sr) ? "Success ! " : "Failure ! ";
            } else if (goal === "sub" && sr !== false) {
                result += ((parseInt(rollresult) + parseInt(char)) <= sr) ? "Success ! " : "Failure ! ";
            }
            result += "You got a " + (parseInt(rollresult) + parseInt(char));
            result += " (" + chartocheck + ": " + char + " + rolled " + rollresult;
            result += get_system_val('multipledice') ? " (" + rolldetails + ")" : '';
            result += ")";
            break;
        case "remove":
            if (goal === "over" && sr !== false) {
                result += ((rollresult - char) >= sr) ? "Success ! " : "Failure ! ";
            } else if (goal === "sub" && sr !== false) {
                result += ((rollresult - char) <= sr) ? "Success ! " : "Failure ! ";
            }
            result += "You got a " + (rollresult - char);
            result += " (" + chartocheck + ": " + char + " - rolled " + rollresult;
            result += get_system_val('multipledice') ? " (" + rolldetails + ")" : '';
            result += ")";
            break;
        default:
            return false;
    }
    return result;
}

function get_system_val(val) {
    return gamedata.dicesystem[val];
}

function play(track) {
    if (track !== '') {
        dispatcher = voicechan.playFile('./audio/' + track + '.mp3');
        dispatcher.on("end", function (end) {
            play(track);
        });
    } else {
        dispatcher.pause();
        dispatcher = null;
    }
}

function stop() {
    if (dispatcher !== null) {
        dispatcher.pause();
        dispatcher = null;
    }
}

client.on('ready', function () {
    console.log('READY !');
});

client.on('message', function (message) {
    var received = message.content;
    if (message.author.tag === "JDRBot#7510" && received === "Goodbye !") {
        process.exit();
    } else if (received.substr(0, 4) === '!jdr') {
        received = received.split(' ');
        switch (received[1]) {
            case 'play':
                play(received[2]);
                break;
            case 'stop':
                stop();
                break;
            case 'join':
                if (!message.guild) {
                    message.reply('This command is only usable on a Guild.');
                    break;
                }
                if (message.member.voiceChannel) {
                    message.member.voiceChannel.join().then(function (connection) {
                        voicechan = connection;
                        console.log('Connected to a voice channel.');
                    }).catch(function(error) {
                        console.log('Error !' + error)
                    });
                }
                break;
            case 'leave':
                message.member.voiceChannel.leave();
                break;
            case 'name':
                var name = message.content.substr(9);
                message.reply(get_number(name));
                break;
            case 'roll':
                if (received[2] !== undefined) {
                    if (!isNaN(parseInt(received[2].charAt(0)))) {
                        var rollresult = roll(received[2]);
                        message.reply(rollresult);
                    } else {
                        if (!isgameon) {
                            message.reply('You should start a game or send a valid basic request. See !jdr help for details.');
                            break;
                        }
                        // console.log(JSON.stringify(users[message.author.tag]));
                        // console.log(JSON.stringify(sheets[users[message.author.tag]]));
                        if (users[message.author.tag] === undefined || sheets[users[message.author.tag]] === undefined) {
                            message.reply('Are you linked to a character ? Be sure your character is registered already.');
                            break;
                        }
                        var rollresult = roll_char(message.author.tag, received[2], received[3]);
                        if (rollresult) {
                            message.reply(rollresult);
                        } else {
                            message.reply("Sorry, the game seem to be badly set up. You get a critical success on shooting the admin with tomatoes !");
                        }
                    }
                } else {
                    if (isgameon) {
                        message.reply(roll(gamedata.dicesystem.dice));
                    }
                }
                break;
            case 'help':
                message.reply('Call "!jdbot roll xdy" to roll a x dice with y faces. For instance, "!jdr roll 2d10" will roll two ten sided dice.');
                break;
            case 'start':
                if (prepare_game(received[2])) {
                    message.channel.send('Started ' + received[2]);
                } else {
                    message.channel.send('The game ' + received[2] + ' has not been found !');
                }
                break;
            case 'link':
                if (link_to(message.author.tag, received[2], message.channel)) {
                    message.channel.send("Adding " + received[2] + " to user " + message.author.tag + "...");
                } else {
                    message.channel.send("Never heard of this character ! Is it written correctly ?");
                }
                break;
            case 'linkto':
                if (link_to(received[2], received[3], message.channel)) {
                    message.channel.send("Adding " + received[3] + " to user " + received[2] + "...");
                } else {
                    message.channel.send("Never heard of this character ! Is it written correctly ?");
                }
                break;
            case 'check':
                var carac = get_char(message.author.tag, received[2]);
                if (carac) {
                    message.channel.send(received[2] + ' : ' + carac);
                } else {
                    message.channel.send('Not found !');
                }
                break;
            case 'save':
                message.channel.send(savegame(received[2], received[3]));
                break;
            case 'load':
                loadgame(received[2], received[3], received[4], message.channel);
                break;
            case 'shutdown':
                if (message.author.tag === "Baka Killer#8806") {
                    message.channel.send('Goodbye !');
                }
                break;
            default :
                message.reply('What are you trying to do ? You can call "!jdr help" to see how to use.');
        }
    }
});

client.login('MzE4NTI0MjQzOTcxNDA3ODg3.DAzoYg.nZyECJ-aERngiIpLjhltKwKbIpg');

//
// var http = require('http');
// var url = require('url');
//
// var server = http.createServer(function (req, res) {
//     res.writeHead(200, {"Content-Type": "application/json"});
//     var myurl = url.parse(req.url).pathname;
//     res.end(JSON.stringify({object: "THIS", machin: "THAT", url: myurl}));
// });
//
// server.listen(8080);