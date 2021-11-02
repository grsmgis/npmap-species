var subNavZ, headerZ, divHeader, divSubNav,
  NPMap = {
    div: 'map',
    baseLayers: [
      'nps-parkTiles3',
      'esri-topographic',
      'nps-parkTiles3Imagery',
      'nps-parkTiles3Slate',
    ],
    overlays: [{
      name: 'Trails',
      url: 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/GRSM_TRAILS/FeatureServer/0/query?f=geojson&outSR=4326&where=OBJECTID%20IS%20NOT%20NULL&outFields=TRAILNAME',
      type: 'geojson',
      popup: {
        description: '<div style="text-align: center">{{TRAILNAME}}</div>'
      },
      styles: {
        line: {
          'stroke': '#cb9733',
          'stroke-opacity': 0.75
        }
      }
    }, {
      name: 'Visitor Centers',
      url: 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/ArcGIS/rest/services/GRSM_VISITOR_CENTERS/FeatureServer/0/query?f=geojson&outSR=4326&where=OBJECTID%20IS%20NOT%20NULL&outFields=*',
      type: 'geojson',
      popup: {
        description: '<div style="text-align: center">{{LOC_NAME}}</div>'
      },
      styles: {
        point: {
          'marker-color': '#000000',
          'marker-size': 'medium',
          'marker-symbol': 'visitor-center-white',
          'marker-library': 'npmapsymbollibrary',
        }
      }
    }, {
      name: 'Shelters',
      url: 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/ArcGIS/rest/services/GRSM_BACKCOUNTRY_SHELTERS/FeatureServer/0/query?f=geojson&outSR=4326&where=OBJECTID%20IS%20NOT%20NULL&outFields=*',
      type: 'geojson',
      popup: {
        description: '<div style="text-align: center">{{TEXT_NAME}}</div>'
      },
      styles: {
        point: {
          'marker-color': '#000000',
          'marker-size': 'medium',
          'marker-symbol': 'shelter-white',
          'marker-library': 'npmapsymbollibrary',
        }
      }
    }, {
      name: 'Roads',
      url: 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/GRSM_ROAD_CENTERLINES/FeatureServer/0/query?f=geojson&outSR=4326&where=OBJECTID%20IS%20NOT%20NULL&outFields=*',
      type: 'geojson',
      popup: {
        description: '<center>{{RDNAME}}</center>'
      },
      styles: {
        line: {
          'stroke': '#222222',
          'stroke-opacity': 0.75
        }
      }
    }, {
      name: 'Campsites',
      url: 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/ArcGIS/rest/services/GRSM_BACKCOUNTRY_CAMPSITES/FeatureServer/0/query?f=geojson&outSR=4326&where=OBJECTID%20IS%20NOT%20NULL&outFields=*',
      type: 'geojson',
      popup: {
        description: '<div style="text-align: center">{{LABEL}}</div>'
      },
      styles: {
        point: {
          'marker-color': '#000000',
          'marker-size': 'medium',
          'marker-symbol': 'campsite-white',
          'marker-library': 'npmapsymbollibrary',
        }
      }
    }, {
      name: 'Park Boundary',
      url: 'https://services1.arcgis.com/fBc8EJBxQRMcHlei/arcgis/rest/services/Great_Smoky_Mountains_National_Park_Boundary/FeatureServer/0/query?f=geojson&outSR=4326&where=OBJECTID%20IS%20NOT%20NULL&outFields=*',
      type: 'geojson',
      popup: {
        description: '<div style="text-align: center">Great Smoky Mountains National Park</div>'
      },
      styles: {
        line: {
          'stroke': '#ab6124',
          'stroke-opacity': 0.9,
          'stroke-width': '2px'
        }
      }
    }],
    zoom: 11,
    center: { lat: 35.6, lng: -83.52 },
    minZoom: 11,
    maxZoom: 15,
    maxBounds: [
      { lat: 35, lng: -84.5 },
      { lat: 36.25, lng: -82.5 }
    ],
    homeControl: false,
    editControl: true,
    printControl: true,
    measureControl: true,
    scaleControl: { metric: true },
    events: [{
      fn: function (evt) {
        if (currentBaseLayer && evt.layer._leaflet_id === currentBaseLayer._leaflet_id) {
          drawData();
        }
      },
      type: 'layeradd'
    }]
  };
