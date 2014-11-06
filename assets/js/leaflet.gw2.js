function GW2Map() {

    this._map = null;
    this._mapLayer = null;
    this._mapOverlays = {
        "Region names": null,
        "Map names": null,
        "Map boundaries": null
    };

    this._localAPIPath = "";

    this._continentsControl = null;

    this.continents = { };


    this.initMap = function(map_id, initCallback) {
        var _this = this;
        this._map = L.map(map_id, { crs: L.CRS.Simple });
        this._map.on("overlayadd", this._mapOnOverlayAdd, this);
        this._map.on("zoomend", this._mapOnZoomEnd, this);

        L.easyButton("glyphicon-resize-full", function() {
            var $o = $(".glyphicon", this._container);
            if ($o.hasClass("glyphicon-resize-full")) {
                $o.removeClass("glyphicon-resize-full").addClass("glyphicon-resize-small");
            } else {
                $o.removeClass("glyphicon-resize-small").addClass("glyphicon-resize-full");
            }
            $("#" + map_id).toggleClass("leaflet-fullscreen");
            _this._map.invalidateSize();
        }, "Toggle fullscreen", _this._map);

        getGW2API("/v1/continents.json", function(data) {
            _this.continents = data.continents;
            for (var i in _this.continents) {
                _this.continents[i].continent_id = i;
                _this.continents[i].map_floor = { };
            }

            var tyria = _this.continents[1];
            _this._mapLayer = L.gw2MapLayer("https://{s}.guildwars2.com/{continent}/{floor}/{z}/{x}/{y}.jpg", {
                minZoom: tyria.min_zoom,
                maxZoom: tyria.max_zoom,
                continuousWorld: true,
                subdomains: ["tiles", "tiles1", "tiles2", "tiles3", "tiles4"],
                continent: tyria.continent_id,
                floor: 1
            });

            _this._mapLayer.on("continentchange", _this._layerOnContinentChange, _this);
            _this._mapLayer.on("floorchange", _this._layerOnFloorChange, _this);
            _this._mapLayer.addTo(_this._map);

            _this._continentsControl = L.control.gw2Continents(_this.continents, _this._mapLayer);
            _this._continentsControl.addTo(_this._map);

            for (var i in _this._mapOverlays) {
                _this._mapOverlays[i] = L.layerGroup().addTo(_this._map);
            }
            L.control.layers(null, _this._mapOverlays).addTo(_this._map);

            _this.updateMapView();
            if (initCallback) {
                initCallback();
            }
        });
    };

    //=================
    // Getters/setters
    //=================
    this.getMap = function() {
        return this._map;

    }

    this.getLayer = function() {
        return this._mapLayer;

    }

    this.getLocalAPIPath = function() {
        return this._localAPIPath;
    }

    this.setLocalAPIPath = function(path) {
        this._localAPIPath = path;
    }


    //=========================
    // Layer content functions
    //=========================
    this.updateMapView = function() {
        var continent_id = this._mapLayer.getActiveContinent();
        var floor_id = this._mapLayer.getActiveFloor();

        var _this = this;
        var continent = this.continents[continent_id];
        var floor = null;
        var width = continent.continent_dims[0];
        var height = continent.continent_dims[1];

        this._map.options.minZoom = continent.min_zoom;
        this._map.options.maxZoom = continent.max_zoom;
        this._map.setView(this.unproject([width / 2, height / 2]), 3);

        if (!continent.map_floor[floor_id]) {
            getGW2API("/v1/map_floor.json?continent_id=" + continent_id + "&floor=" + floor_id, function(data) {
                continent.map_floor[floor_id] = data;
                floor = data;
                var view = [0, 0, width, height];
                if (floor.clamped_view) {
                    view = [floor.clamped_view[0][0], floor.clamped_view[0][1], floor.clamped_view[1][0], floor.clamped_view[1][1]];
                }
                _this.setMaxBounds(view[0], view[1], view[2], view[3]);
                _this.placeRegionNames(floor.regions);
            });
        } else {
            floor = continent.map_floor[floor_id];
            var view = [0, 0, width, height];
            if (floor.clamped_view) {
                view = [floor.clamped_view[0][0], floor.clamped_view[0][1], floor.clamped_view[1][0], floor.clamped_view[1][1]];
            }
            this.setMaxBounds(view[0], view[1], view[2], view[3]);
            _this.placeRegionNames(floor.regions);
        }

        if (!continent.maps) {
            getGW2API(["/v1/maps.json", "/v1/map_names.json", "/map_types.json"], function(data) {
                var mapsData = data[0].maps;
                var mapNames = data[1];
                var mapTypes = data[2].map_types;
                var maps = { };

                for (var id in mapsData) {
                    if (id in mapTypes) {
                        mapsData[id].map_type = mapTypes[id].type;
                    }
                }

                if (continent_id == 1) {
                    // Tyria has too many instanced maps which will show up if we don't filter it manually
                    for (var i in mapNames) {
                        var id = mapNames[i].id;
                        if (id in mapsData && mapsData[id].continent_id == continent_id) {
                            maps[id] = mapsData[id];
                            maps[id].map_id = id;
                        }
                    }
                    for (var id in mapTypes) {
                        if (!(id in maps) && id in mapsData && mapsData[id].continent_id == continent_id) {
                            if (mapTypes[id].type != "") {
                                maps[id] = mapsData[id];
                                maps[id].map_id = id;
                            }
                        }
                    }
                } else {
                    // Other continent(s) don't have instanced maps like the ones in Tyria, so we get all maps
                    for (var id in mapsData) {
                        if (mapsData[id].continent_id == continent_id) {
                            maps[id] = mapsData[id];
                            maps[id].map_id = id;
                        }
                    }
                }

                var floor_maps = { };
                for (var i in maps) {
                    var map = maps[i];
                    for (var floor in map.floors) {
                        floor = map.floors[floor];
                        if (!floor_maps[floor]) {
                            floor_maps[floor] = { };
                        }
                        floor_maps[floor][map.map_id] = map;
                    }
                }
                continent.maps = floor_maps;
                _this.placeMapNames(floor_maps[floor_id]);
                _this.placeMapBoundaries(floor_maps[floor_id]);
            }, [null, null, this._localAPIPath]);
        } else {
            this.placeMapNames(continent.maps[floor_id]);
            this.placeMapBoundaries(continent.maps[floor_id]);
        }

        this._map.fireEvent("mapviewupdate");
    };

    this.placeRegionNames = function(regions) {
        this._mapOverlays["Region names"].clearLayers();

        for (var region_id in regions) {
            var region = regions[region_id];
            var className = "region-label region-label-" + region_id;

            var label = L.divIcon({ className: className, html: region.name, iconSize: null });
            var regionNameOverlay = L.marker(this.unproject(region.label_coord), { icon: label, zIndexOffset: 1000, clickable: false });
            this._mapOverlays["Region names"].addLayer(regionNameOverlay);
        }

        $(".region-label").fixMapIconAnchor();
    }

    this.placeMapNames = function(maps) {
        this._mapOverlays["Map names"].clearLayers();

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
            var mapNameOverlay = L.marker(this.unproject(label_coord), { icon: label, clickable: false });
            this._mapOverlays["Map names"].addLayer(mapNameOverlay);
        }

        $(".map-label").fixMapIconAnchor();
    }

    this.placeMapBoundaries = function(maps) {
        this._mapOverlays["Map boundaries"].clearLayers();

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

            var continent_rect2 = [this.unproject(continent_rect[0]), this.unproject(continent_rect[1])];
            var mapBoundariesOverlay = L.rectangle(continent_rect2, { className: className, weight: 1, clickable: true }).bindPopup(popup);
            this._mapOverlays["Map boundaries"].addLayer(mapBoundariesOverlay);
        }
    }


    //================
    // Event handlers
    //================
    this._mapOnOverlayAdd = function(e) {
        switch (e.name) {
            case "Region names":
                $(".region-label").fixMapIconAnchor();
                break;
            case "Map names":
                $(".map-label").fixMapIconAnchor();
                break;
        }
    };

    this._mapOnZoomEnd = function(e) {
        var zoom = this._map.getZoom();
        $(this._map._container).attr("zoom-level", zoom);
        $(".region-label, .map-label").fixMapIconAnchor();
    };

    this._layerOnContinentChange = function(e) {
        this.updateMapView();
    };

    this._layerOnFloorChange = function(e) {
        this.updateMapView();
    };


    //======================
    // Map helper functions
    //======================
    this.project = function(latlon) {
        return this._map.project(latlon, this._map.getMaxZoom());
    }

    this.unproject = function(coord) {
        return this._map.unproject(coord, this._map.getMaxZoom());
    }

    this.setMaxBounds = function(left, top, right, bottom) {
        var southWest = this.unproject([left, bottom]);
        var northEast = this.unproject([right, top]);
        var latlng = new L.LatLngBounds(southWest, northEast);
        this._mapLayer.options.bounds = latlng;
        this._map.setMaxBounds(latlng);
    };

}


L.GW2MapLayer = L.TileLayer.extend({
    initialize: function(url, options) {
        this._parent = Object.getPrototypeOf(Object.getPrototypeOf(this));
        this._parent.initialize(url, options);

        this._floors = { };

        if (options.continent) {
            if (options.floor) {
                this._floors[options.continent] = options.floor;
            }
        }
    },

    getActiveContinent: function() {
        return this.options.continent;
    },

    getActiveFloor: function() {
        return this.options.floor;
    },

    setActiveContinent: function(continentId, floorId) {
        var oldContinent = this.options.continent;
        this.options.continent = continentId;

        if (floorId === undefined) {
            floorId = this._floors[continentId];
        }
        if (floorId === undefined) {
            floorId = 1;
        }

        this.options.floor = floorId;
        this._floors[continentId] = floorId;
        this.redraw();

        if (oldContinent != continentId) {
            this.fireEvent("continentchange", { continent: continentId });
        }
    },

    setActiveFloor: function(floorId) {
        var oldFloor = this.options.floor;
        this.options.floor = floorId;

        this._floors[this.options.continent] = floorId;
        this.redraw();

        if (oldFloor != floorId) {
            this.fireEvent("floorchange", { floor: floorId });
        }
    }
});

L.gw2MapLayer = function(url, options) {
    return new L.GW2MapLayer(url, options);
}


L.Control.GW2Continents = L.Control.extend({
    options: {
        collapsed: true,
        position: "topright",
        autoZIndex: true
    },

    initialize: function(continents, gw2layer, options) {
        L.setOptions(this, options);
        this._gw2layer = gw2layer;

        this._continents = { };
        for (var i in continents) {
            this.addContinent(continents[i]);
        }
    },


    addContinent: function(continent) {
        this._continents[continent.continent_id] = continent;
        return this;
    },

    removeContinent: function(continentId) {
        delete this._continents[continentId];
        return this;
    },


    onAdd: function(map) {
        this._initLayout();
        this._update();

        this._gw2layer.on("continentchange", this._onContinentChange, this);
        this._gw2layer.on("floorchange", this._onFloorChange, this);
        return this._container;
    },

    onRemove: function(map) {
        this._gw2layer.off("continentchange", this._onContinentChange, this);
        this._gw2layer.off("floorchange", this._onFloorChange, this);
    },


    _initLayout: function() {
		var className = 'leaflet-control-layers',
            container = this._container = L.DomUtil.create('div', className + " leaflet-control-continents");

		//Makes this work on IE10 Touch devices by stopping it from firing a mouseout event when the touch is released
		container.setAttribute('aria-haspopup', true);

		if (!L.Browser.touch) {
			L.DomEvent
				.disableClickPropagation(container)
				.disableScrollPropagation(container);
		} else {
			L.DomEvent.on(container, 'click', L.DomEvent.stopPropagation);
		}

		var form = this._form = L.DomUtil.create('form', className + '-list');

		if (this.options.collapsed) {
			if (!L.Browser.android) {
				L.DomEvent
				    .on(container, 'mouseover', this._expand, this)
				    .on(container, 'mouseout', this._collapse, this);
			}
			var link = this._layersLink = L.DomUtil.create('a', className + '-toggle glyphicon glyphicon-globe', container);
			link.href = '#';
			link.title = 'Layers';

			if (L.Browser.touch) {
				L.DomEvent
				    .on(link, 'click', L.DomEvent.stop)
				    .on(link, 'click', this._expand, this);
			}
			else {
				L.DomEvent.on(link, 'focus', this._expand, this);
			}
			//Work around for Firefox android issue https://github.com/Leaflet/Leaflet/issues/2033
            // Note: Seems to break more than it actually fixes......
            //  - Causes the same events to be fired multiple times (how many times depends on how deep the element is nested)
            //  - The general click event on the form is redirected to the input click (form is bigger than the input elements anyone?)
            // So I'm sorry Firefox for Android users, but I'm disabling this workaround on this custom control
            // If this is still a problem, I'd love to hear a better solution than the one from 2013
			/*L.DomEvent.on(form, 'click', function () {
				setTimeout(L.bind(this._onInputClick, this), 0);
			}, this);*/

			this._map.on('click', this._collapse, this);
			// TODO keyboard accessibility
		} else {
			this._expand();
		}

		this._continentsList = L.DomUtil.create('div', className + '-continents', form);
        var floorsSelectorLabel = L.DomUtil.create("label", "", form);
        floorsSelectorLabel.innerHTML = "Floor:<br />";
        this._floorsSelector = L.DomUtil.create('select', className + '-floors', floorsSelectorLabel);
        this._floorsSelector.id = "floors-selector";
        this._floorsSelector.size = 5;
        L.DomEvent.on(this._floorsSelector, 'change', this._onFloorSelectorChange, this);

		container.appendChild(form);
	},

    _update: function() {
        if (!this._container) {
            return;
        }

        this._continentsList.innerHTML = "";

        for (var i in this._continents) {
            var continent = this._continents[i];
            this._addContinent(continent);
        }

        this._updateFloorsSelector();
    },

    _updateFloorsSelector: function() {
        this._floorsSelector.innerHTML = "";

        var activeContinent = this._continents[this._gw2layer.getActiveContinent()];
        for (var i in activeContinent.floors) {
            var floor = activeContinent.floors[i];
            this._addFloor(floor);
        }
    },

	_onContinentChange: function(e) {
        var continent = this._continents[e.continent];

		if (!continent) { return; }

		if (!this._handlingClick) {
			this._update();
		} else {
            this._updateFloorsSelector();
        }
	},

    _onFloorChange: function(e) {
        if (!this._handlingClick) {
            this._updateFloorsSelector;
        }
    },

    // IE7 bugs out if you create a radio dynamically, so you have to do it this hacky way (see http://bit.ly/PqYLBe)
	_createRadioElement: function(name, checked) {
		var radioHtml = '<input type="radio" class="leaflet-control-layers-selector" name="' + name + '"';
		if (checked) {
			radioHtml += ' checked="checked"';
		}
		radioHtml += '/>';

		var radioFragment = document.createElement('div');
		radioFragment.innerHTML = radioHtml;

		return radioFragment.firstChild;
	},

    _addContinent: function(continent) {
        var checked = this._gw2layer.getActiveContinent() == continent.continent_id;
		var input = this._createRadioElement('leaflet-control-continents-selector', checked);
		input.continentId = continent.continent_id;

		L.DomEvent.on(input, 'click', this._onContinentInputClick, this);

		var name = document.createElement('span');
		name.innerHTML = ' ' + continent.name;

		var label = document.createElement('label');
		label.appendChild(input);
		label.appendChild(name);

		this._continentsList.appendChild(label);
		return label;
    },

    _addFloor: function(floor) {
        var selected = this._gw2layer.getActiveFloor() == floor;
        var option = document.createElement("option");
        option.value = floor;
        if (selected) {
            option.selected = "selected";
        }
        option.innerHTML = floor;

        this._floorsSelector.appendChild(option);
        return option;
    },

    _onContinentInputClick: function() {
		var inputs = this._form.getElementsByTagName('input');
		this._handlingClick = true;

		for (var i = 0; i < inputs.length; i++) {
		    var input = inputs[i];
			if (input.checked) {
                var continent = this._continents[input.continentId];
                this._gw2layer.setActiveContinent(continent.continent_id);
			}
		}

		this._handlingClick = false;
		this._refocusOnMap();
	},

    _onFloorSelectorChange: function() {
        this._handlingClick = true;
        var select = document.getElementById("floors-selector");
        var floor = select.value;
        this._gw2layer.setActiveFloor(floor);

        this._handlingClick = false;
        this._refocusOnMap();
    },

	_expand: function() {
		L.DomUtil.addClass(this._container, 'leaflet-control-layers-expanded leaflet-control-continents-expanded');
	},

	_collapse: function() {
		this._container.className = this._container.className.replace(' leaflet-control-layers-expanded leaflet-control-continents-expanded', '');
	}
});

L.control.gw2Continents = function(continents, gw2layer, options) {
    return new L.Control.GW2Continents(continents, gw2layer, options);
}
