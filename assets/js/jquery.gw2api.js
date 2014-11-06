function getGW2API(endpoint, callback, urlbase) {
    if ($.isArray(endpoint)) {
        var todo = endpoint.length;
        var done = 0;
        var returnedData = [];
        $.each(endpoint, function(index, val) {
            var base = urlbase;
            if ($.isArray(base)) {
                base = base[index];
            }
            if (!base) {
                base = "https://api.guildwars2.com";
            }

            $.ajax({
                cache: false,
                url: base + val,
                dataType: "json",
                success: function(data) {
                    done++;
                    returnedData[index] = data;
                    if (done >= todo) {
                        callback(returnedData);
                    }
                },
                error: function(jqxhr, status, error) {
                    console.log(jqxhr, status, error);
                }
            });
        });
    } else if ($.type(endpoint) == "string") {
        if (!urlbase) {
            urlbase = "https://api.guildwars2.com";
        }

        $.ajax({
            cache: false,
            url: urlbase + endpoint,
            dataType: "json",
            success: function(data) {
                callback(data);
            }
        });
    }
}
