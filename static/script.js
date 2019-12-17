country = 'US'
maxMinutes = 9
queueInterval = 10000
queue = []
trackPlaying = null

brand.addEventListener('click', function() {
    $('#searchTable').hide()
    $('#queueTable').show()
})

searchForm.addEventListener('submit', function(event) {
    event.preventDefault()
    search()
})

searchButton.addEventListener('click', function(event) {
    search()
})

playQueue()
function playQueue() {
    var url = '/queue'
    axios.get(url).then(function(res) {
        queue = res.data
        //console.log('queue', queue)

        var lines = ''
        for (let i = 0; i < queue.length; i++) {
            var track = queue[i]
            var lineResult = '<tr>'

            lineResult += '<td>'+(i+1)+'</td>'
            
            if (track.provider == 'spotify') {
                lineResult += '<td><img height="64" src="'+track.info.album.images[1].url+'"></td>'
                
                var artists = []
                for (let y = 0; y < track.info.artists.length; y++) {
                    artists.push(track.info.artists[y].name)
                }
                artists = artists.join(' + ')
                lineResult += '<td>'+artists+' - '+track.info.name+'</td>'

                var duration = Math.round(track.duration / 1000)
                lineResult += '<td>'+formatDuration(duration)+'</td>'

                lineResult += '<td>Spotify</td>'
                lineResult += '<td>'
            }

            if (track.provider == 'youtube') {
                lineResult += '<td><img height="64" src="https://i.ytimg.com/vi/'+track.id+'/hqdefault.jpg"></td>'
                lineResult += '<td>'+track.info.title+'</td>'

                var duration = Math.round(track.duration / 1000)
                lineResult += '<td>'+formatDuration(duration)+'</td>'

                lineResult += '<td>YouTube</td>'
                lineResult += '<td>'
            }
            lineResult += '</tr>\n\n'
            lines += lineResult
        }
        $("#queueBody").html(lines)
        if (lines.length == 0)
            $('.noQueue').show()
        else
            $('.noQueue').hide()

        if (queue.length > 0) playTrack()

        setTimeout(function() {
            playQueue()
        }, queueInterval)
    })
}

function search(e) {
    if (e) e.preventDefault()
    $("#searchSpinner").show()
    var url = '/search?t='+searchTerm.value
    axios.get(url).then(function(res) {
        var json = res.data
        console.log('search', json)
        $('#queueTable').hide()
        $('#searchTable').show()
        
        var linesSpotify = []
        var linesYoutube = []
        if (json.spotify)
            for (let i = 0; i < json.spotify.length; i++) {
                var track = json.spotify[i]
                if (track.available_markets.indexOf(country) === -1)
                    continue;

                var lineResult = '<tr>'
                lineResult += '<td><img height="64" src="'+track.album.images[1].url+'"></td>'

                var artists = []
                for (let y = 0; y < track.artists.length; y++) {
                    artists.push(track.artists[y].name)
                }
                artists = artists.join(' + ')
                lineResult += '<td>'+artists+' - '+track.name+'</td>'

                var duration = Math.round(track.duration_ms / 1000)
                lineResult += '<td>'+formatDuration(duration)+'</td>'

                lineResult += '<td>Spotify</td>'

                if (track.preview_url)
                    lineResult += '<td><a class="btn btn-primary btn-sm" href="'+track.preview_url+'" target="_blank"><i data-feather="eye"></i></a></td>'
                else lineResult += '<td></td>'
                lineResult += '<td><button class="btn btn-primary btn-sm" onclick="play(\'spotify\', \''+track.id+'\')"><i data-feather="play"></i> Play</button></td>'
                lineResult += '</tr>'

                if (Math.floor(track.duration_ms/60000) > maxMinutes)
                    continue;

                linesSpotify.push(lineResult)
            }
            
        if (json.yt)
            for (let i = 0; i < json.yt.length; i++) {
                var video = json.yt[i]
                if (!video.seconds && video.timestamp == "")
                    continue;
                var lineResult = '<tr>'
                lineResult += '<td><img height="64" src="https://i.ytimg.com/vi/'+video.videoId+'/hqdefault.jpg"></td>'
                lineResult += '<td>'+video.title+'</td>'
                if (video.timestamp)
                    lineResult += '<td>'+video.timestamp+'</td>'
                else
                    lineResult += '<td>'+formatDuration(video.duration)+'</td>'
                lineResult += '<td>YouTube</td>'
                lineResult += '<td><a class="btn btn-primary btn-sm" href="https://youtu.be/'+video.videoId+'" target="_blank"><i data-feather="eye"></i></a></td>'
                lineResult += '<td><button class="btn btn-primary btn-sm" onclick="play(\'youtube\', \''+video.videoId+'\')"><i data-feather="play"></i> Play</button></td>'
                lineResult += '</tr>'

                if (video.timestamp.split(':').length > 2)
                    continue;
                    
                if (video.timestamp && video.timestamp.split(':')[video.timestamp.split(':').length - 2] > maxMinutes)
                    continue;

                if (video.duration && typeof video.duration !== "object" && video.duration > maxMinutes*60)
                    continue;

                linesYoutube.push(lineResult)
            }

        var lines = []
        var i = 0
        while (i < linesSpotify.length || i < linesYoutube.length) {
            if (linesYoutube[i])
                lines.push(linesYoutube[i])
            if (linesSpotify[i])
                lines.push(linesSpotify[i])

            i++
        }

        $("#searchBody").html(lines.join('\n\n'))
        feather.replace()
        $("#searchSpinner").hide()
    })
}

function charge(songName, provider, id) {
    console.log('trying to play', provider, id)

    axios.post('/charge', {
        song: songName,
        provider: provider,
        id: id
    })
    .then(function (res) {
        var json = res.data
        console.log('playing', json)
    })
    .catch(function (error) {
        console.log(error);
    });
}

function play(provider, id) {
    console.log('trying to play', provider, id)

    axios.post('/play', {
        provider: provider,
        id: id
    })
    .then(function (res) {
        var json = res.data
        console.log('playing', json)
    })
    .catch(function (error) {
        console.log(error);
    });
}

function formatDuration(duration) {
    var minutes = Math.floor(duration/60)
    var seconds = String(duration % 60)
    if (seconds.length === 1) seconds = '0'+seconds
    return minutes+':'+seconds
}

function playTrack(forceNextTrack) {
    if (!queue) return
    var track = queue[0]
    if (trackPlaying && trackPlaying.id == track.id) {
        if (forceNextTrack && queue[1]) track = queue[1]
        else return
    }
    trackPlaying = track
    if (track.timePlayed > track.duration)
        track.timePlayed = track.duration
    if (track.timePlayed < 0)
        track.timePlayed = 0
    var secsPlayed = Math.round(track.timePlayed / 1000)

    if (track.provider == 'youtube')
        player.innerHTML = '<iframe width="100%" height="100%" src="https://www.youtube.com/embed/'+track.id+'?autoplay=1&start='+secsPlayed+'" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>'
    if (track.provider == 'spotify')
        player.innerHTML = '<iframe width="100%" height="100%" src="https://open.spotify.com/embed/track/'+track.id+'" frameborder="0" allowtransparency="true" allow="encrypted-media"></iframe>'
    
    setTimeout(function() {
        playTrack(true)
    }, track.duration - track.timePlayed)
}