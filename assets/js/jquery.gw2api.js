function getGW2API(endpoint, callback) {
    if ($.isArray(endpoint)) {
        var todo = endpoint.length;
        var done = 0;
        var returnedData = [];
        $.each(endpoint, function(index, val) {
            $.getJSON("https://api.guildwars2.com" + val, function(data) {
                done++;
                returnedData[index] = data;
                if (done >= todo) {
                    callback(returnedData);
                }
            });
        });
    } else if ($.type(endpoint) == "string") {
        $.getJSON("https://api.guildwars2.com" + endpoint, function(data) {
            callback(data);
        });
    }
}
