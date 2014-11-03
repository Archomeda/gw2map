function unproject(leafletmap, coord) {
    return leafletmap.unproject(coord, leafletmap.getMaxZoom());
}

function setMaxBounds(leafletmap, left, top, right, bottom) {
    var southWest = unproject(leafletmap, [left, bottom]);
    var northEast = unproject(leafletmap, [right, top]);
    leafletmap.setMaxBounds(new L.LatLngBounds(southWest, northEast));
}

$.fn.fixMapIconAnchor = function() {
    $(this).css("margin-left", function() {
        return -($(this).width() / 2) + "px";
    }).css("margin-top", function() {
        return -($(this).height() / 2) + "px";
    });
}


function placeRegionNames(leafletmap, overlays, regions) {
    overlays["Region names"].clearLayers();

    for (var region_id in regions) {
        var region = regions[region_id];

        var className = "region-label region-label-" + region_id;

        var label = L.divIcon({ className: className, html: region.name, iconSize: null });
        var regionName = L.marker(unproject(leafletmap, region.label_coord), { icon: label, zIndexOffset: 1000, clickable: false });
        overlays["Region names"].addLayer(regionName);
    }

    $(".region-label").fixMapIconAnchor();
}

function placeMapNames(leafletmap, overlays, maps) {
    overlays["Map names"].clearLayers();

    for (var map_id in maps) {
        var map = maps[map_id];
        var region_id = map.region_id;
        var continent_rect = map.continent_rect;

        var className = "map-label map-label-" + map_id + " map-label-region-" + region_id;
        switch (map.map_type) {
            case "city":
                className += " map-label-city";
                break;
            case "dungeon":
                className += " map-label-dungeon";
                break;
            default:
                className += " map-label-default";
                break;
        }

        var label_coord = [(continent_rect[0][0] + continent_rect[1][0]) / 2, (continent_rect[0][1] + continent_rect[1][1]) / 2];
        var label = L.divIcon({ className: className, html: map.map_name, iconSize: null });
        var mapName = L.marker(unproject(leafletmap, label_coord), { icon: label, clickable: false });
        overlays["Map names"].addLayer(mapName);
    }

    $(".map-label").fixMapIconAnchor();
}

function placeMapBoundaries(leafletmap, overlays, maps) {
    overlays["Map boundaries"].clearLayers();

    for (var map_id in maps) {
        var map = maps[map_id];
        var continent_rect = map.continent_rect;
        var region_id = map.region_id;
        var map_rect = map.map_rect;

        var className = "map-boundary map-boundary-" + map_id + " region-boundary-" + region_id;
        switch (map.map_type) {
            case "city":
                className += " region-boundary-map-city";
                break;
            case "dungeon":
                className += " region-boundary-map-dungeon";
                break;
            default:
                className += " region-boundary-map-default";
                break;
        }
        var popupTitle = map.map_name + " (" + map.region_name + ") - " + map_id;

        var popup = "<b>" + popupTitle + "</b><br /><br />" +
            "Continent coords: from (" + continent_rect[0][0] + "," + continent_rect[0][1] + ") to (" + continent_rect[1][0] + "," + continent_rect[1][1] + ")<br />" +
            "Continent size: " + (continent_rect[1][0] - continent_rect[0][0]) + " x " + (continent_rect[1][1] - continent_rect[0][1]) + "<br />" +
            "Map size: " + (map_rect[1][0] - map_rect[0][0]) + " x " + (map_rect[1][1] - map_rect[0][1]) + "<br />" +
            "Floors: " + map.floors.join(",");

        var continent_rect2 = [unproject(leafletmap, continent_rect[0]), unproject(leafletmap, continent_rect[1])];
        var mapBoundaries = L.rectangle(continent_rect2, { className: className, weight: 1, clickable: true }).bindPopup(popup);
        overlays["Map boundaries"].addLayer(mapBoundaries);
    }
}
