// EXPRESS HTTP SERV
// YT + SPOTIFY (LIMIT TO 10 mins songs)
// QUEUE SYSTEM
// ADMIN ACCOUNT CAN ADD SONGS WITHOUT PAYING
// PAYMENTS (PAYPAL + CRYPTO)
const config = require('./config.js')
const yt = require('youtube-info')
const ytSearch = require('yt-search')

var coinbase = require('coinbase-commerce-node');
var Client = coinbase.Client;
Client.init(config.coinbaseApi);
var Charge = coinbase.resources.Charge;
var Webhook = coinbase.Webhook

// const SpotifyWebApi = require('spotify-web-api-node')
// var spotify = new SpotifyWebApi({
//     clientId: '60e4f987ae08484aa360eb3598ad135d',
//     clientSecret: '62ce43bf4d0a435bb009e45da451e0e2'
// });
// getSpotifyAccess()
// function getSpotifyAccess() {
//     spotify.clientCredentialsGrant().then(
//         function(data) {
//           console.log('Got spotify token, expires in ' + Math.round(data.body['expires_in']/60)+' mins')
//           spotify.setAccessToken(data.body['access_token'])
//           setTimeout(function() {
//               getSpotifyAccess()
//           }, (data.body['expires_in']-5)*1000)
//         },
//         function(err) {
//           console.log('Something went wrong when retrieving an access token', err)
//         }
//     )
// }

var playQueue = []

const express = require('express')
const app = express()
app.use(express.urlencoded())
app.use(express.json())
app.use(express.static('static'))
app.enable('trust proxy')

// coinbase verify payments
app.post('/webhook/', function(req, res) {
    var signature = req.headers['x-cc-webhook-signature']
    //console.log(signature, req.body)
    try {
        event = Webhook.verifyEventBody(
                JSON.stringify(req.body),
                signature,
                config.coinbaseSecret
        );
    } catch (error) {
        console.log('Error occured', error.message);
        res.status(400).send('Webhook Error:' + error.message);
        return;
    }
    res.send('Signed Webhook Received: ' + event.id);
    var status = event.type
    console.log('Coinbase '+status+' '+event.data.code)
    // db.collection('charges').updateOne({id: event.data.id}, {"$set": {
    //     "status": status,
    //     "timeline": event.data.timeline
    // }})
    // db.collection('charges').findOne({id: event.data.id}, function(err, charge) {
    //     if (status === 'charge:confirmed')
    //         emails.sendOrderComplete(charge, function(err) {
    //             if (err) console.log(err)
    //         })
    // })
})

app.post('/charge', function(req, response) {
    console.log('charge', req.body)
    var chargeData = {
        name: 'Play '+req.body.song+' on the jukebox',
        description: req.body.id+'@'+req.body.provider,
        local_price: {
            amount: "0.99",
            currency: 'EUR'
        },
        pricing_type: 'fixed_price'
    }

    Charge.create(chargeData, function(err, res) {
        console.log(err, res)
        response.json({
            code: res.code
        })
    })
})

app.post('/play', function(req, response) {
    var provider = req.body.provider
    var id = req.body.id

    if (!provider || !id) {
        response.json({error: 'missing parameters in request'})
        return
    }

    console.log(provider)

    getInfo(provider, id, function(err, info) {
        if (err) {
            response.json({error: err})
            return
        }

        var duration = 0
        // if (provider == 'spotify')
        //     duration = info.duration_ms
        if (provider == 'youtube') {
            duration = info.duration*1000
        }

        var ts = new Date().getTime()
        if (playQueue.length > 0) {
            ts = playQueue[0].ts
            for (let i = 0; i < playQueue.length; i++)
                ts += playQueue[i].duration
        }
        
        playQueue.push({
            ts: ts,
            duration: duration,
            info: info,
            provider: provider,
            id: id
        })
        console.log('playing ', provider, id)
        response.json(info)
    })
})

app.get('/queue', function(req, response) {
    for (let i = playQueue.length - 1; i >= 0; i--) {
        if (new Date().getTime() > playQueue[i].ts + playQueue[i].duration)
            playQueue.splice(0, 1)
    }
    if (playQueue.length > 0) {
        var time = new Date().getTime()
        playQueue[0].timePlayed = time - playQueue[0].ts
    }
    response.json(playQueue)
})

app.get('/search', function (req, response) {
    // check if its a link
    // https://www.youtube.com/watch?v=jb7cTUwPG-A&list=PL_UadMDQ7fDM-PFW3e_1EZ1ahrCxRICwh&index=10
    // https://youtu.be/jb7cTUwPG-A?list=PL_UadMDQ7fDM-PFW3e_1EZ1ahrCxRICwh
    // https://open.spotify.com/track/33yAEqzKXexYM3WlOYtTfQ
    // (not working) https://www.youtube.com/watch?list=PL_UadMDQ7fDM-PFW3e_1EZ1ahrCxRICwh&v=oi3QmAmrG6M&index=11

    // console.log(req.query)
    var searchTerm = req.query.t
    var searchSplit = searchTerm.split('/')
    var videoId = null
    var videoProvider = null
    switch (searchSplit[2]) {
        case 'www.youtube.com':
            var qs = searchSplit[3].split('?')[1].split('&')
            for (let i = 0; i < qs.length; i++)
                if (qs[i].split('=')[0] === 'v') {
                    videoProvider = 'youtube'
                    videoId = qs[i].split('=')[1]
                }
            break;

        case 'youtu.be':
            videoProvider = 'youtube'
            videoId = searchSplit[3].split('?')[0]
            break;

        // case 'open.spotify.com':
        //     videoProvider = 'spotify'
        //     videoId = searchSplit[4]
        //     break;
    
        default:
            break;
    }

    if (videoId && videoProvider) {
        console.log('Link used', videoProvider, videoId)
        getInfo(videoProvider, videoId, function(err, info) {
            if (videoProvider == 'youtube')
                response.json({
                    yt: [info]
                })
            // if (videoProvider == 'spotify')
            //     response.json({
            //         spotify: [info]
            //     })
        })
        return
    }

    console.log('Searching for: '+searchTerm)
    ytSearch(searchTerm, function(err, res) {
        var ytVideos = res.videos
        console.log("Found "+ytVideos.length+" videos on YouTube");
        response.json({
            // spotify: spotifyTracks,
            yt: ytVideos
        })
    })
})
 
app.listen(3000)

function getInfo(provider, id, cb) {
    switch (provider) {
        case 'youtube':
            yt(id, function(err, info) {
                if (err) cb(err)
                else cb(null, info)
            })
            break;

        // case 'spotify':
        //     spotify.getTrack(id).then(function(data) {
        //         cb(null, data.body)
        //     }, function(err) {
        //         console.log(err)
        //     })
        //     break;

        default:
            cb('unavailable provider')
            break;
    }
}