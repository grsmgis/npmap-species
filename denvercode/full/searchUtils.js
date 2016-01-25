var control = {
  _latinFuser: undefined,
  _commonFuser: undefined,
  _nameMappings: undefined,
  _commonToLatin: undefined,
  _similarDistributions: undefined,
  _simThreshold: 200,
  _simDistLength: undefined,
  _aucValues: undefined,
  _selectedSpecies: [],
  _lastPredictionState: true,
  _lastObservationState: false
}

function prepareSearchTool() {
  loadResource('http://nationalparkservice.github.io/npmap-species/atbirecords/lexical_index.json', function(data) {
    var index = data.items,
      latinOptions = {
        keys: ['latin_name_ref'],
        threshold: 0.3
      },
      commonOptions = {
        keys: ['common_name'],
        threshold: 0.3
      }

    control._latinFuser = new Fuse(index, latinOptions);
    control._commonFuser = new Fuse(index, commonOptions);
  });

  loadResource('http://nationalparkservice.github.io/npmap-species/atbirecords/irma_mapping.json', function(data) {
    control._nameMappings = data;
    delete control._nameMappings[''];

    populateResults();
  });

  loadResource('http://nationalparkservice.github.io/npmap-species/atbirecords/most_similar_distribution.json', function(data) {
    control._similarDistributions = data;
  });

  loadResource('http://nationalparkservice.github.io/npmap-species/atbirecords/most_similar_environment.json', function(data) {
    control._similarEnvironments = data;
  });

  loadResource('http://nationalparkservice.github.io/npmap-species/atbirecords/species_auc.json', function(data) {
    control._aucValues = data;
  });
}

function loadResource(url, callback) {
  loadResourceWithTries(url, callback, 1);
}

function loadResourceWithTries(url, callback, tries) {
  jQuery.ajax({
    type: 'GET',
    url: url,
    dataType: 'json',
    success: callback,
    error: function() {
      if(tries < 5) {
        loadResourceWithTries(url, callback, tries+1);
      }
    }
  });
}

function populateResults() {
  var keys = [];
  for(key in control._nameMappings) {
    keys.push(key);
  }
  keys.sort();

  var li = document.createElement('li');
  li.innerHTML = 'Clear selection';
  li.onclick = function() {
    clearSearch();
  }
  document.getElementById('search-initial-dropdown-latin').appendChild(li);
  for(var i = 0; i < keys.length; i++) {
    var latin = keys[i];
    var common = control._nameMappings[keys[i]].common;
    var id = control._nameMappings[keys[i]].id;

    li = document.createElement('li');
    li._latin = latin;
    li._id = id;
    li._common = common;
    li.innerHTML = li._latin.replace(/_/g, ' ');
    li.title = li._common.replace(/_/g, ' ');
    li.onclick = function() {
      toggleSearchList();
      selectInitialSpecies(this);
    }
    document.getElementById('search-initial-dropdown-latin').appendChild(li);
  }

  var commonNames = [];
  for(var i = 0; i < keys.length; i++) {
    var common = control._nameMappings[keys[i]].common;
    var latin = keys[i];
    var id = control._nameMappings[keys[i]].id;
    if(!(common in commonNames)) {
      commonNames[common] = [];
    }
    commonNames[common].push({
      _latin: latin,
      _id: id
    });
  }

  keys = [];
  for(key in commonNames) {
    if(key !== 'Unspecified') {
      keys.push(key);
    }
  }
  keys.sort();

  li = document.createElement('li');
  li.innerHTML = 'Clear selection';
  li.onclick = function() {
    clearSearch();
  }
  document.getElementById('search-initial-dropdown-common').appendChild(li);
  for(var i = 0; i < keys.length; i++) {
    var key = keys[i];
    for(var j = 0; j < commonNames[key].length; j++) {
      li = document.createElement('li');
      li._latin = commonNames[key][j]._latin;
      li._id = commonNames[key][j]._id;
      li._common = key;
      li.innerHTML = li._common.replace(/_/g, ' ');
      li.title = li._latin.replace(/_/g, ' ');
      li.onclick = function() {
        toggleSearchList();
        selectInitialSpecies(this);
      }
      document.getElementById('search-initial-dropdown-common').appendChild(li);
    }
  }
}

var listShown = false;
function toggleSearchList(callback) {
  if(!listShown) {
    if(whichName === 'common') {
      $('#search-initial-dropdown-common').stop();
      $('#search-initial-dropdown-common').animate({height: '400px'}, callback);
    } else {
      $('#search-initial-dropdown-latin').stop();
      $('#search-initial-dropdown-latin').animate({height: '400px'}, callback);
    }
  } else {
    if(whichName === 'common') {
      $('#search-initial-dropdown-common').stop();
      $('#search-initial-dropdown-common').animate({height: '0px'}, callback);
    } else {
      $('#search-initial-dropdown-latin').stop();
      $('#search-initial-dropdown-latin').animate({height: '0px'}, callback);
    }
  }

  listShown = !listShown;
}

function clearSearch() {
  toggleSearchList();

  // remove all selected species
  document.getElementById('search-initial-dropdown').children[0].innerHTML = 'Select a species';
  document.getElementById('search-initial-dropdown').children[0].title = '';
  document.getElementById('search-initial-dropdown').style.backgroundColor = '#40403d';

  for(var i = 0; i < control._selectedSpecies.length; i++) {
    if(control._selectedSpecies[i] !== undefined) {
      recordAction('removed species: ' + control._selectedSpecies[i]._latin.replace(/_/g, ' '));

      if(showPredicted) {
        NPMap.config.L.removeLayer(control._selectedSpecies[i].predicted);
      }

      if(showObserved && i == 0) {
        NPMap.config.L.removeLayer(control._selectedSpecies[i].observed);
      }
    }
  }

  control._selectedSpecies = [];

  if(control._lastPredictionState === false) {
    document.getElementById('options-predicted-checkbox').disabled = false;
    $('#options-predicted-checkbox').trigger('click');
  }
  document.getElementById('options-predicted-checkbox').disabled = true;
  document.getElementById('options-observed-checkbox').disabled = true;

  document.getElementById('search-compare-placeholder').style.display = 'block';
  document.getElementById('search-compare-contents').style.display = 'none';
  document.getElementById('search-initial-image').style.opacity = '0';

  $('#color-legend').animate({height: '0px'});
}

function selectInitialSpecies(li) {
  recordAction('added species: ' + li._latin.replace(/_/g, ' '));
  clearComparisons();

  document.getElementById('search-initial-dropdown').children[0].innerHTML = li.innerHTML;
  document.getElementById('search-initial-dropdown').children[0].title = li.title;
  document.getElementById('search-initial-dropdown').style.backgroundColor = 'rgb(202, 24, 146)';
  document.getElementById('legend-pink-contents-name').innerHTML = li.innerHTML;
  document.getElementById('legend-pink-contents-name').title = li.title;

  if(control._selectedSpecies[0] !== undefined && control._selectedSpecies[0].visible) {
    recordAction('removed species: ' + control._selectedSpecies[0]._latin.replace(/_/g, ' '));

    if(showPredicted) {
      NPMap.config.L.removeLayer(control._selectedSpecies[0].predicted);
    }

    if(showObserved) {
      NPMap.config.L.removeLayer(control._selectedSpecies[0].observed);
    }
  }

  control._selectedSpecies[0] = {};
  control._selectedSpecies[0]._id = li._id;
  control._selectedSpecies[0]._latin = li._latin;
  control._selectedSpecies[0]._common = li._common;
  control._selectedSpecies[0].visible = true;

  control._selectedSpecies[0].observed = L.npmap.layer.geojson({
    name: li._latin + '_observations',
    url: 'https://nps-grsm.cartodb.com/api/v2/sql?filename=' + li._latin + '&format=geojson&q=SELECT+DISTINCT+ON+(the_geom)+*+FROM+grsm_species_observations_maxent+WHERE+lower(genus_speciesmaxent)=lower(%27' + li._latin + '%27)',
    type: 'geojson',
    popup: {
      title: 'Common: ' + li._common.replace(/_/g, ' ') + "<br>"
        + 'Latin: ' + li._latin.replace(/_/g, ' '),
      description: 'This observation was recorded on '
        + '{{dateretrieved}}, at {{lon}}&#176;, {{lat}}&#176;, {{elevation}} feet '
        + 'in {{parkdistrict}}. It is best accessed by {{road}} and {{trail}}.<br><br>'
        + 'Download observations: '
        + '<a href="https://nps-grsm.cartodb.com/api/v2/sql?filename=' + li._latin + '&format=csv&q=SELECT+DISTINCT+ON+(the_geom)+*+FROM+grsm_species_observations_maxent+WHERE+lower(genus_speciesmaxent)=lower(%27' + li._latin + '%27)">CSV</a> | '
        + '<a href="https://nps-grsm.cartodb.com/api/v2/sql?filename=' + li._latin + '&format=kml&q=SELECT+DISTINCT+ON+(the_geom)+*+FROM+grsm_species_observations_maxent+WHERE+lower(genus_speciesmaxent)=lower(%27' + li._latin + '%27)">KML</a> | '
        + '<a href="https://nps-grsm.cartodb.com/api/v2/sql?filename=' + li._latin + '&format=geojson&q=SELECT+DISTINCT+ON+(the_geom)+*+FROM+grsm_species_observations_maxent+WHERE+lower(genus_speciesmaxent)=lower(%27' + li._latin + '%27)">GeoJSON</a> | '
        + '<a href="https://nps-grsm.cartodb.com/api/v2/sql?filename=' + li._latin + '&format=shp&q=SELECT+DISTINCT+ON+(the_geom)+*+FROM+grsm_species_observations_maxent+WHERE+lower(genus_speciesmaxent)=lower(%27' + li._latin + '%27)">SHP</a>'
        + '<br><br><a target="_blank" href="http://www.nps.gov/grsm/learn/nature/research.htm">Contribute to this dataset</a>'
    },
    tooltip: li._common.replace(/_/g, ' '),
    styles: {
      point: {
        'marker-color': 'rgb(202, 24, 146)',
        'marker-size': 'medium'
      }
    },
    cluster: {
      clusterIcon: 'rgb(202, 24, 146)'
    },
    disableClusteringAtZoom: 15,
    polygonOptions: {
      color: 'rgb(202, 24, 146)',
      fillColor: 'rgb(202, 24, 146)'
    }
  });

  document.getElementById('options-predicted-checkbox').disabled = false;
  document.getElementById('options-observed-checkbox').disabled = false;

  drawData();
  if(showObserved) {
    control._selectedSpecies[0].observed.addTo(NPMap.config.L);
  }

  document.getElementById('search-compare-placeholder').style.display = 'none';
  document.getElementById('search-compare-contents').style.display = 'block';
  document.getElementById('search-initial-image').style.opacity = '1';

  findAUC(0, li._latin);

  $('#color-legend').animate({height: '100px'});
  $('input', '#legend-pink-controls').prop('checked', true);

  populateLists();
}

function populateLists() {
  populateDistributionLists();
  populateEnvironmentLists();
}

function populateDistributionLists() {
  document.getElementById('compare-dist-one').children[2].innerHTML = '';
  document.getElementById('compare-dist-two').children[2].innerHTML = '';

  if(control._selectedSpecies[0] === undefined) {
    return;
  }

  var sp = control._selectedSpecies[0]._latin,
    results = control._similarDistributions[sp],
    found = [
      sp.replace(/_/g, ' '),
      $('#compare-dist-one-name').html(),
      $('#compare-dist-one-name').prop('title'),
      $('#compare-dist-two-name').html(),
      $('#compare-dist-two-name').prop('title')
    ];

  var li = document.createElement('li');
  li.innerHTML = 'Clear selection';
  li.onclick = function() {
    clearCompareOne();
  }
  document.getElementById('compare-dist-one').children[2].appendChild(li);
  li = document.createElement('li');
  li.innerHTML = 'Clear selection';
  li.onclick = function() {
    clearCompareTwo();
  }
  document.getElementById('compare-dist-two').children[2].appendChild(li);

  for(var i = 0; i < 15; i++) {
    var max = -1,
      maxItem = '';
    for(var key in results) {
      if(found.indexOf(key.replace(/_/g, ' ')) === -1) {
        if(results[key] > max && results[key] > control._simThreshold && (whichName === 'latin' || control._nameMappings[key].common !== 'Unspecified')) {
          max = results[key];
          maxItem = key;
        }
      }
    }

    if(results[maxItem] > control._simThreshold) {
      found.push(maxItem.replace(/_/g, ' '));

      var latin = maxItem,
        common = control._nameMappings[latin].common,
        id = control._nameMappings[latin].id;

      li = document.createElement('li');
      li._latin = latin;
      li._common = common;
      li._id = id;
      if(whichName === 'common') {
        li.innerHTML = li._common;
        li.title = li._latin.replace(/_/g, ' ');
      } else {
        li.innerHTML = li._latin.replace(/_/g, ' ');
        li.title = li._common;
      }
      li.onclick = function() {
        selectSecondSpecies(this);
      }
      document.getElementById('compare-dist-one').children[2].appendChild(li);

      li = document.createElement('li');
      li._latin = latin;
      li._common = common;
      li._id = id;
      if(whichName === 'common') {
        li.innerHTML = li._common;
        li.title = li._latin.replace(/_/g, ' ');
      } else {
        li.innerHTML = li._latin.replace(/_/g, ' ');
        li.title = li._common;
      }
      li.onclick = function() {
        selectThirdSpecies(this);
      }
      document.getElementById('compare-dist-two').children[2].appendChild(li);
    }
  }

  control._simDistLength = found.length;
  $('#compare-dist-one').stop();
  if(compareDistOneActive) {
    $('#compare-dist-one').animate({height:((control._simDistLength-5)*21+41) + 'px'});
    $('ul', '#compare-dist-one').css({display:'block'});
  }
  $('#compare-dist-two').stop();
  if(compareDistTwoActive) {
    $('#compare-dist-two').animate({height:((control._simDistLength-5)*21+41) + 'px'});
    $('ul', '#compare-dist-two').css({display:'block'});
  }
}

function populateEnvironmentLists() {
  document.getElementById('compare-env-one').children[2].innerHTML = '';
  document.getElementById('compare-env-two').children[2].innerHTML = '';

  if(control._selectedSpecies[0] === undefined) {
    return;
  }

  var sp = control._selectedSpecies[0]._latin,
    results = control._similarEnvironments[sp],
    found = [
      sp.replace(/_/g, ' '),
      $('#compare-env-one-name').html(),
      $('#compare-env-one-name').prop('title'),
      $('#compare-env-two-name').html(),
      $('#compare-env-two-name').prop('title')
    ];

    var li = document.createElement('li');
    li.innerHTML = 'Clear selection';
    li.onclick = function() {
      clearCompareOne();
    }
    document.getElementById('compare-env-one').children[2].appendChild(li);
    li = document.createElement('li');
    li.innerHTML = 'Clear selection';
    li.onclick = function() {
      clearCompareTwo();
    }
    document.getElementById('compare-env-two').children[2].appendChild(li);

    for(var i = 0; i < 15; i++) {
      var max = -1,
        maxItem = '';
      for(var key in results) {
        if(found.indexOf(key.replace(/_/g, ' ')) === -1) {
          if(results[key] > max && (whichName === 'latin' || control._nameMappings[key].common !== 'Unspecified')) {
            max = results[key];
            maxItem = key;
          }
        }
      }
      found.push(maxItem.replace(/_/g, ' '));

      var latin = maxItem,
        common = control._nameMappings[latin].common,
        id = control._nameMappings[latin].id;

      li = document.createElement('li');
      li._latin = latin;
      li._common = common;
      li._id = id;
      if(whichName === 'common') {
        li.innerHTML = li._common;
        li.title = li._latin.replace(/_/g, ' ');
      } else {
        li.innerHTML = li._latin.replace(/_/g, ' ');
        li.title = li._common;
      }
      li.onclick = function() {
        selectSecondSpecies(this);
      }
      document.getElementById('compare-env-one').children[2].appendChild(li);

      li = document.createElement('li');
      li._latin = latin;
      li._common = common;
      li._id = id;
      if(whichName === 'common') {
        li.innerHTML = li._common;
        li.title = li._latin.replace(/_/g, ' ');
      } else {
        li.innerHTML = li._latin.replace(/_/g, ' ');
        li.title = li._common;
      }
      li.onclick = function() {
        selectThirdSpecies(this);
      }
      document.getElementById('compare-env-two').children[2].appendChild(li);
    }
}

function clearCompareOne() {
  $('#legend-species-orange').stop();
  $('#legend-species-orange').animate({
    height: '0px',
    marginBottom: '0px'
  });

  if(control._selectedSpecies[1] !== undefined) {
    recordAction('removed species: ' + control._selectedSpecies[1]._latin.replace(/_/g, ' '));
    $('#color-legend').stop();
    $('#color-legend').animate({
      height: $('#color-legend').height()-50
    });
  }

  $('#search-compare-one-box-input').val('');
  $('#search-compare-one-box-input').trigger('input');
  $('#search-compare-one-box-name').css({display:'none'});
  $('#search-compare-one-box-clear').css({display:'none'});
  $('#compare-dist-one-name').html('Select a second species');
  $('#compare-dist-one-name').prop('title', '');
  $('#compare-dist-one-name').css({backgroundColor:'#40403d'});
  $('#compare-env-one-name').html('Select a second species');
  $('#compare-env-one-name').prop('title', '');
  $('#compare-env-one-name').css({backgroundColor:'#40403d'});

  if(control._selectedSpecies[1] !== undefined) {
    if(showPredicted) {
      NPMap.config.L.removeLayer(control._selectedSpecies[1].predicted);
    }
  }

  control._selectedSpecies[1] = undefined;

  if(control._selectedSpecies[2] === undefined) {
    document.getElementById('options-predicted-checkbox').disabled = false;
    document.getElementById('options-observed-checkbox').disabled = false;

    if(control._lastPredictionState === false) {
      control._lastPredictionState = true;
      $('#options-predicted-checkbox').trigger('click');
    }

    if(control._lastObservationState === true) {
      control._lastObservationState = false;
      $('#options-observed-checkbox').trigger('click');
    }
  }

  populateDistributionLists();
  populateEnvironmentLists();
}

function selectSecondSpecies(li) {
  recordAction('added species: ' + li._latin.replace(/_/g, ' '));

  $('#legend-species-orange').stop();
  $('#legend-species-orange').animate({
    height: '49px',
    marginBottom: '1px'
  });

  if(control._selectedSpecies[1] === undefined) {
    $('#color-legend').stop();
    $('#color-legend').animate({
      height: $('#color-legend').height()+50
    });
  }

  document.getElementById('legend-orange-contents-name').innerHTML = li.innerHTML;
  document.getElementById('legend-orange-contents-name').title = li.title;

  $('#search-compare-one-box-input').val('');
  $('#search-compare-one-box-input').trigger('input');

  if(whichName === 'common') {
    $('#search-compare-one-box-name').html(li._common);
    $('#search-compare-one-box-name').prop('title', li._latin.replace(/_/g, ' '));
    $('#compare-dist-one-name').html(li._common);
    $('#compare-dist-one-name').prop('title', li._latin.replace(/_/g, ' '));
    $('#compare-env-one-name').html(li._common);
    $('#compare-env-one-name').prop('title', li._latin.replace(/_/g, ' '));
  } else {
    $('#search-compare-one-box-name').html(li._latin.replace(/_/g, ' '));
    $('#search-compare-one-box-name').prop('title', li._common);
    $('#compare-dist-one-name').html(li._latin.replace(/_/g, ' '));
    $('#compare-dist-one-name').prop('title', li._common);
    $('#compare-env-one-name').html(li._latin.replace(/_/g, ' '));
    $('#compare-env-one-name').prop('title', li._common);
  }
  $('#search-compare-one-box-name').css({display:'block'});
  $('#search-compare-one-box-clear').css({display:'block'});
  $('#compare-dist-one-name').css({backgroundColor:'rgb(242, 142, 67)'});
  $('#compare-env-one-name').css({backgroundColor:'rgb(242, 142, 67)'});

  if(control._selectedSpecies[1] !== undefined && control._selectedSpecies[1].visible) {
    recordAction('removed species: ' + control._selectedSpecies[1]._latin.replace(/_/g, ' '));

    if(showPredicted) {
      NPMap.config.L.removeLayer(control._selectedSpecies[1].predicted);
    }
  }

  control._selectedSpecies[1] = {};
  control._selectedSpecies[1]._id = li._id;
  control._selectedSpecies[1]._latin = li._latin;
  control._selectedSpecies[1]._common = li._common;
  control._selectedSpecies[1].visible = true;

  if(!showPredicted) {
    control._lastPredictionState = false;
    $('#options-predicted-checkbox').trigger('click');
  }
  if(showObserved) {
    control._lastObservationState = true;
    $('#options-observed-checkbox').trigger('click');
  }
  document.getElementById('options-predicted-checkbox').disabled = true;
  document.getElementById('options-observed-checkbox').disabled = true;

  drawData();

  findAUC(1, li._latin);

  $('input', '#legend-orange-controls').prop('checked', true);

  populateDistributionLists();
  populateEnvironmentLists();
}

function clearCompareTwo() {
  $('#legend-species-blue').stop();
  $('#legend-species-blue').animate({
    height: '0px',
    marginBottom: '0px'
  });

  if(control._selectedSpecies[2] !== undefined) {
    recordAction('removed species: ' + control._selectedSpecies[2]._latin.replace(/_/g, ' '));
    $('#color-legend').stop();
    $('#color-legend').animate({
      height: $('#color-legend').height()-50
    });
  }

  $('#search-compare-two-box-input').val('');
  $('#search-compare-two-box-input').trigger('input');
  $('#search-compare-two-box-name').css({display:'none'});
  $('#search-compare-two-box-clear').css({display:'none'});
  $('#compare-dist-two-name').html('Select a third species');
  $('#compare-dist-two-name').prop('title', '');
  $('#compare-dist-two-name').css({backgroundColor:'#40403d'});
  $('#compare-env-two-name').html('Select a third species');
  $('#compare-env-two-name').prop('title', '');
  $('#compare-env-two-name').css({backgroundColor:'#40403d'});

  if(control._selectedSpecies[2] !== undefined) {
    recordAction('removed species: ' + control._selectedSpecies[2]._latin.replace(/_/g, ' '));

    if(showPredicted) {
      NPMap.config.L.removeLayer(control._selectedSpecies[2].predicted);
    }
  }

  control._selectedSpecies[2] = undefined;

  if(control._selectedSpecies[1] === undefined) {
    document.getElementById('options-predicted-checkbox').disabled = false;
    document.getElementById('options-observed-checkbox').disabled = false;

    if(control._lastPredictionState === false) {
      control._lastPredictionState = true;
      $('#options-predicted-checkbox').trigger('click');
    }

    if(control._lastObservationState === true) {
      control._lastObservationState = false;
      $('#options-observed-checkbox').trigger('click');
    }
  }

  populateDistributionLists();
  populateEnvironmentLists();
}

function selectThirdSpecies(li) {
  recordAction('added species: ' + li._latin.replace(/_/g, ' '));

  $('#legend-species-blue').stop();
  $('#legend-species-blue').animate({
    height: '49px',
    marginBottom: '1px'
  });

  if(control._selectedSpecies[2] === undefined) {
    $('#color-legend').stop();
    $('#color-legend').animate({
      height: $('#color-legend').height()+50
    });
  }

  document.getElementById('legend-blue-contents-name').innerHTML = li.innerHTML;
  document.getElementById('legend-blue-contents-name').title = li.title;

  $('#search-compare-two-box-input').val('');
  $('#search-compare-two-box-input').trigger('input');

  if(whichName === 'common') {
    $('#search-compare-two-box-name').html(li._common);
    $('#search-compare-two-box-name').prop('title', li._latin.replace(/_/g, ' '));
    $('#compare-dist-two-name').html(li._common);
    $('#compare-dist-two-name').prop('title', li._latin.replace(/_/g, ' '));
    $('#compare-env-two-name').html(li._common);
    $('#compare-env-two-name').prop('title', li._latin.replace(/_/g, ' '));
  } else {
    $('#search-compare-two-box-name').html(li._latin.replace(/_/g, ' '));
    $('#search-compare-two-box-name').prop('title', li._common);
    $('#compare-dist-two-name').html(li._latin.replace(/_/g, ' '));
    $('#compare-dist-two-name').prop('title', li._common);
    $('#compare-env-two-name').html(li._latin.replace(/_/g, ' '));
    $('#compare-env-two-name').prop('title', li._common);
  }
  $('#search-compare-two-box-name').css({display:'block'});
  $('#search-compare-two-box-clear').css({display:'block'});
  $('#compare-dist-two-name').css({backgroundColor:'rgb(29, 144, 156)'});
  $('#compare-env-two-name').css({backgroundColor:'rgb(29, 144, 156)'});

  if(control._selectedSpecies[2] !== undefined && control._selectedSpecies[2].visible) {
    if(showPredicted) {
      NPMap.config.L.removeLayer(control._selectedSpecies[2].predicted);
    }
  }

  control._selectedSpecies[2] = {};
  control._selectedSpecies[2]._id = li._id;
  control._selectedSpecies[2]._latin = li._latin;
  control._selectedSpecies[2]._common = li._common;
  control._selectedSpecies[2].visible = true;

  if(!showPredicted) {
    control._lastPredictionState = false;
    $('#options-predicted-checkbox').trigger('click');
  }
  if(showObserved) {
    control._lastObservationState = true;
    $('#options-observed-checkbox').trigger('click');
  }
  document.getElementById('options-predicted-checkbox').disabled = true;
  document.getElementById('options-observed-checkbox').disabled = true;

  drawData();

  findAUC(2, li._latin);

  $('input', '#legend-blue-controls').prop('checked', true);

  populateDistributionLists();
  populateEnvironmentLists();
}

var searchActive = false;
function toggleLexicalSearch() {
  searchActive = !searchActive;

  if(searchActive) {
    if(listShown) {
      toggleSearchList(function() {
        document.getElementById('search-initial-box').style.display = 'block';
        document.getElementById('search-initial-box-input').focus();
      });
    } else {
      document.getElementById('search-initial-box').style.display = 'block';
      document.getElementById('search-initial-box-input').focus();
    }
  } else {
    document.getElementById('search-initial-box').style.display = 'none';
  }
}

var compareDistOneActive = false;
function toggleCompareDistOne() {
  compareDistOneActive = !compareDistOneActive;

  $('#compare-dist-one').stop();
  if(compareDistOneActive) {
    $('#compare-dist-one').animate({height:((control._simDistLength-5)*21+41) + 'px'});
    $('ul', '#compare-dist-one').css({display:'block'});
  } else {
    $('#compare-dist-one').animate({height:'20px'});
    $('ul', '#compare-dist-one').css({display:'none'});
  }
}

var compareDistTwoActive = false;
function toggleCompareDistTwo() {
  compareDistTwoActive = !compareDistTwoActive;

  $('#compare-dist-two').stop();
  if(compareDistTwoActive) {
    $('#compare-dist-two').animate({height:((control._simDistLength-5)*21+41) + 'px'});
    $('ul', '#compare-dist-two').css({display:'block'});
  } else {
    $('#compare-dist-two').animate({height:'20px'});
    $('ul', '#compare-dist-two').css({display:'none'});
  }
}

var compareEnvOneActive = false;
function toggleCompareEnvOne() {
  compareEnvOneActive = !compareEnvOneActive;

  $('#compare-env-one').stop();
  if(compareEnvOneActive) {
    $('#compare-env-one').animate({height:'356px'});
    $('ul', '#compare-env-one').css({display:'block'});
  } else {
    $('#compare-env-one').animate({height:'20px'});
    $('ul', '#compare-env-one').css({display:'none'});
  }
}

var compareEnvTwoActive = false;
function toggleCompareEnvTwo() {
  compareEnvTwoActive = !compareEnvTwoActive;

  $('#compare-env-two').stop();
  if(compareEnvTwoActive) {
    $('#compare-env-two').animate({height:'356px'});
    $('ul', '#compare-env-two').css({display:'block'});
  } else {
    $('#compare-env-two').animate({height:'20px'});
    $('ul', '#compare-env-two').css({display:'none'});
  }
}

function fuseSearch(idx, value) {
  var value = value,
    commonResults = control._commonFuser.search(value),
    latinResults = control._latinFuser.search(value),
    results = (whichName === 'common')
      ? commonResults.slice(0, 15)
      : latinResults.slice(0, 15);

  /* replace unspecified names */
  if(whichName === 'common') {
    var j = 15;
    for(var i = 0; i < results.length; i++) {
      if(results[i].common_name === 'Unspecified') {
        while(commonResults[j].common_name === 'Unspecified') {
          j++;
        }
        results[i] = commonResults[j];
        j++;
      }
    }
  }

  /* for species comparison searches, remove species already selected from search results */
  if(idx === 1 || idx === 2) {
    for(var i = 0; i < results.length; i++) {
      for(var j = 0; j < control._selectedSpecies.length; j++) {
        if(control._selectedSpecies[j] !== undefined) {
          if(results[i].latin_name === control._selectedSpecies[j]._latin) {
            results.splice(i--, 1);
          }
        }
      }
    }
  }

  switch(idx) {
    case 0:
      elString = '#search-initial-box';
      break;
    case 1:
      elString = '#search-compare-one-box';
      break;
    case 2:
      elString = '#search-compare-two-box';
      break;
    default:
      return;
  }
  $(elString).stop();
  $(elString).animate({
    height: 20+results.length*21 + 'px'
  });

  document.getElementById(elString.substring(1)).children[1].innerHTML = '';
  for(var i = 0; i < results.length; i++) {
    var li = document.createElement('li');
    li._latin = results[i].latin_name;
    li._id = results[i].irma_id;
    li._common = results[i].common_name;
    li._idx = idx;
    if(whichName === 'common') {
      li.innerHTML = li._common.replace(/_/g, ' ');
      li.title = li._latin.replace(/_/g, ' ');
    } else {
      li.innerHTML = li._latin.replace(/_/g, ' ');
      li.title = li._common.replace(/_/g, ' ');
    }
    li.onclick = function() {
      switch(this._idx) {
        case 0:
          toggleLexicalSearch();
          selectInitialSpecies(this);
          break;
        case 1:
          selectSecondSpecies(this);
          break;
        case 2:
          selectThirdSpecies(this);
          break;
        default:
          break;
      }
    }
    document.getElementById(elString.substring(1)).children[1].appendChild(li);
  }
}

function clearComparisons() {
  clearCompareOne();
  clearCompareTwo();
  $('#color-legend').stop();
  $('#color-legend').animate({height:'100px'});
  populateDistributionLists();
  populateEnvironmentLists();
}

function lexFocus() {
  clearComparisons();

  $('#search-compare-lexical').animate({width:'481px'});
  $('.subhead', '#search-compare-lexical').css({display:'block'});
  $('.subhead2', '#search-compare-lexical').css({
    top:'5px',
    fontSize:'14pt',
    color:'#f5faf2',
    width:'200px'
  });
  $('.subhead2', '#search-compare-lexical').html('ANOTHER SPECIES IN THE PARK');
  $('#search-compare-one-box').css({display:'block'});
  $('#search-compare-two-box').css({display:'block'});

  $('#search-compare-distribution').animate({width:'120px'});
  $('.subhead', '#search-compare-distribution').css({display:'none'});
  $('.subhead2', '#search-compare-distribution').css({
    top:'25px',
    fontSize:'9pt',
    color:'#909090',
    width:'80px'
  });
  $('.subhead2', '#search-compare-distribution').html('COMPARE DISTRIBUTION');
  $('#compare-dist-one').css({display:'none'});
  $('#compare-dist-two').css({display:'none'});

  $('#search-compare-environment').animate({width:'120px'});
  $('.subhead', '#search-compare-environment').css({display:'none'});
  $('.subhead2', '#search-compare-environment').css({
    top:'25px',
    fontSize:'9pt',
    color:'#909090',
    width:'80px'
  });
  $('.subhead2', '#search-compare-environment').html('COMPARE ENVIRONMENT');
  $('#compare-env-one').css({display:'none'});
  $('#compare-env-two').css({display:'none'});
}

function distFocus() {
  clearComparisons();

  $('#search-compare-lexical').animate({width:'121px'});
  $('.subhead', '#search-compare-lexical').css({display:'none'});
  $('.subhead2', '#search-compare-lexical').css({
    top:'25px',
    fontSize:'9pt',
    color:'#909090',
    width:'80px'
  });
  $('.subhead2', '#search-compare-lexical').html('COMPARE SPECIES');
  $('#search-compare-one-box').css({display:'none'});
  $('#search-compare-two-box').css({display:'none'});

  $('#search-compare-distribution').animate({width:'480px'});
  $('.subhead', '#search-compare-distribution').css({display:'block'});
  $('.subhead2', '#search-compare-distribution').css({
    top:'5px',
    fontSize:'14pt',
    color:'#f5faf2',
    width:'200px'
  });
  $('.subhead2', '#search-compare-distribution').html('SPECIES WITH SIMILAR DISTRIBUTION');
  $('#compare-dist-one').css({display:'block'});
  $('#compare-dist-two').css({display:'block'});

  $('#search-compare-environment').animate({width:'120px'});
  $('.subhead', '#search-compare-environment').css({display:'none'});
  $('.subhead2', '#search-compare-environment').css({
    top:'25px',
    fontSize:'9pt',
    color:'#909090',
    width:'80px'
  });
  $('.subhead2', '#search-compare-environment').html('COMPARE ENVIRONMENT');
  $('#compare-env-one').css({display:'none'});
  $('#compare-env-two').css({display:'none'});
}

function envFocus() {
  clearComparisons();

  $('#search-compare-lexical').animate({width:'121px'});
  $('.subhead', '#search-compare-lexical').css({display:'none'});
  $('.subhead2', '#search-compare-lexical').css({
    top:'25px',
    fontSize:'9pt',
    color:'#909090',
    width:'80px'
  });
  $('.subhead2', '#search-compare-lexical').html('COMPARE SPECIES');
  $('#search-compare-one-box').css({display:'none'});
  $('#search-compare-two-box').css({display:'none'});

  $('#search-compare-distribution').animate({width:'120px'});
  $('.subhead', '#search-compare-distribution').css({display:'none'});
  $('.subhead2', '#search-compare-distribution').css({
    top:'25px',
    fontSize:'9pt',
    color:'#909090',
    width:'80px'
  });
  $('.subhead2', '#search-compare-distribution').html('COMPARE DISTRIBUTION');
  $('#compare-dist-one').css({display:'none'});
  $('#compare-dist-two').css({display:'none'});

  $('#search-compare-environment').animate({width:'480px'});
  $('.subhead', '#search-compare-environment').css({display:'block'});
  $('.subhead2', '#search-compare-environment').css({
    top:'5px',
    fontSize:'14pt',
    color:'#f5faf2',
    width:'200px'
  });
  $('.subhead2', '#search-compare-environment').html('SPECIES WITH SIMILAR ENVIRONMENT');
  $('#compare-env-one').css({display:'block'});
  $('#compare-env-two').css({display:'block'});
}

function findAUC(idx, name) {
  var color;
  switch(idx) {
    case 0:
      color = 'pink';
      break;
    case 1:
      color = 'orange';
      break;
    case 2:
      color = 'blue';
      break;
    default:
      return;
  }

  var valueStr = control._aucValues[name];
  if(valueStr !== undefined) {
    var value = parseFloat(valueStr);
    if(value < 0.7) {
      $('#legend-' + color + '-quality').html('Poor');
    } else if(value < 0.8) {
      $('#legend-' + color + '-quality').html('Average');
    } else if(value < 0.9) {
      $('#legend-' + color + '-quality').html('Good');
    } else {
      $('#legend-' + color + '-quality').html('Excellent');
    }
  } else {
    $('#legend-' + color + '-quality').html('Unknown');
  }
}

function toggleSpecies(idx) {
  control._selectedSpecies[idx].visible = !control._selectedSpecies[idx].visible;

  if(control._selectedSpecies[idx].visible) {
    if(showPredicted) {
      drawData();
    }

    if(showObserved) {
      control._selectedSpecies[idx].observed.addTo(NPMap.config.L);
    }
  } else {
    if(showPredicted) {
      NPMap.config.L.removeLayer(control._selectedSpecies[idx].predicted);
    }

    if(showObserved) {
      NPMap.config.L.removeLayer(control._selectedSpecies[idx].observed);
    }
  }
}
