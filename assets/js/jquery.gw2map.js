$.fn.fixMapIconAnchor = function() {
    $(this).css("margin-left", function() {
        return -($(this).width() / 2) + "px";
    }).css("margin-top", function() {
        return -($(this).height() / 2) + "px";
    });
}
