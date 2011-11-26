var PaleoApp = (function(){
  var debug = true;
  
  function fuzzCoords(coords){
    coords.latitude += (Math.random() - 0.5) * 0.1;
    coords.longitude += (Math.random() - 0.5) * 0.1;
  }
  
  var App = {
    stores: {},
    views: {},
    collections: {}
  }
  
  // Initialize localStorage Data Store
  App.stores.meals = new Store('meals');
  
  
  // Meal Model
  var Meal = Backbone.Model.extend({
    // Use localStorage datastore
    localStorage: App.stores.meals,
    
    initialize: function(){
      if(!this.get('mealtype')){
        this.set({mealtype: "No Meal Type Set" })
      };
      
      if(!this.get('body')){
        this.set({body: "No Content"})
      };
      
      if(!this.get('timestamp')){
        this.set({timestamp: Date() })
      };

      if(!this.get('rating')){
        this.set({rating: "No Rating"})
      };
    },
    
    // Returns true if the Meal is tagged with timestamp data
    isTimeStampTagged: function(){
      return this.get('timestamp');
    },
    
    // Returns true if the Meal is tagged with location data
    isGeoTagged: function(){
      return this.get('latitude') && this.get('longitude');
    },
    
    // Creates a url for a map pinned with this Meal's location
    mapImageUrl: function(options){
      // Using Google Static Maps API
      // docs: http://code.google.com/apis/maps/documentation/staticmaps/
      
      var base = "http://maps.google.com/maps/api/staticmap?"
      var defaults = {
        zoom: 14,
        height: 500,
        width: 500,
        maptype: 'roadmap',
        sensor: 'false'
      }
      
      // Update options with defaults
      options = _.extend(defaults, options);
      
      // Convert {width:400, height:300} to {size: "400x300"}
      options.size = options.width + "x" + options.height;
      delete options.height;
      delete options.width;
      
      // Add markers to parameters to add a blue pin to the map
      var latlon = this.get('latitude') + "," + this.get('longitude');
      options.markers = "color:blue|label:X|" + latlon;
      
      // Center on this Meal's location
      options.center = latlon;
      
      var url = base + $.param(options);
      return url;
    },
    
    distanceFromCurrent: function(){
      if(!this.isGeoTagged() || !App.currentLocation){
        return -1;
      }
      
      // Convert Degrees to Radians
      function toRad(n){
        return n * Math.PI / 180;
      }
    
    
      var lat1 = App.currentLocation.latitude,
          lat2 = this.get('latitude'),
          lon1 = App.currentLocation.longitude,
          lon2 = this.get('longitude');
  
      var R = 6371; // km
      var dLat = toRad(lat2-lat1);
      var dLon = toRad(lon2-lon1); 
      var a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
              Math.sin(dLon/2) * Math.sin(dLon/2); 
      var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
      var d = R * c;
    
      return d;
    }
    
  })
  
  
  var MealList = Backbone.Collection.extend({
    // This collection is composed of Meal objects
    model: Meal,
    
    // Set the localStorage datastore
    localStorage: App.stores.meals,
    
    initialize: function(){
      var collection = this;
      
      // When localStorage updates, fetch data from the store
      this.localStorage.bind('update', function(){
        collection.fetch();
      })
    }
    
  });
  
  var NearestPageView = Backbone.View.extend({
    events: {
      'click .locate': 'updateLocation'
    },
    
    initialize: function(options){
      this.listView = options.listView;
    },
    
    updateLocation: function(e){
      var pageView = this;
      
      if('geolocation' in navigator){
        navigator.geolocation.getCurrentPosition(function(position){
          if(position && position.coords){
            
            //Set Current Location
            App.currentLocation = position.coords
            pageView.listView.collection.sort();
          }
        })
      }
    }
  })
  
  
  // Views
  var NewFormView = Backbone.View.extend({
    events: {
      "submit form":  "createMeal"
    },
    
    createMeal: function(e){
      var attrs = this.getAttributes(),
          meal = new Meal();
       
      function create(){
        meal.set(attrs);
        meal.save();
        
        //Close
        $('.ui-dialog').dialog('close');
        this.$('input, textarea').val('');
      }
            
      if(attrs.locate == 'yes' && 'geolocation' in navigator){
        //Do geolocate
        navigator.geolocation.getCurrentPosition(function(position){
          // Handle Our Geolocation Results
          if(position && position.coords){
            attrs.latitude = position.coords.latitude;
            attrs.longitude = position.coords.longitude
          }
          
          if(debug){
            fuzzCoords(attrs);
          }
          
          create(); 
        })
      
      }else{
        create();
      }
          
                    
      // Stop browser from actually submitting the form (or following the link)
      e.preventDefault();
      // Stop jQuery Mobile from doing its form magic. We got this.
      e.stopPropagation();
    },
    
    getAttributes: function(){
      return {
        mealtype: this.$('form [name="mealtype"]').val(),
        body: this.$('form [name="body"]').val(),
        timestamp: this.$('form [name="timestamp"]').val(),
        rating: this.$('form [name="rating"]').val()
      }
    }
    
  });
  
  
  // Represents a listview page displaying a collection of Meals
  // Each item is represented by a MealListItemView
  var MealListView = Backbone.View.extend({
    
    initialize: function(){
      _.bindAll(this, 'addOne', 'addAll');
      
      this.collection.bind('add', this.addOne);
      this.collection.bind('refresh', this.addAll);
      
      this.collection.fetch();
    },
    
    addOne: function(meal){
      var view = new MealListItemView({model: meal});
      $(this.el).append(view.render().el);
      
      if('mobile' in $){
        $(this.el).listview().listview('refresh');
      }
    },
    
    addAll: function(){
      $(this.el).empty();
      this.collection.each(this.addOne);
    }
    
  });
  
  var MealListItemView = Backbone.View.extend({
    tagName: 'LI',
    template: _.template($('#meal-list-item-template').html()),
    
    initialize: function(){
      _.bindAll(this, 'render')
      
      this.model.bind('change', this.render)
    },
    
    render: function(){
      $(this.el).html(this.template({ meal: this.model }))
      return this;
    }
    
  })
  
  /* Container for MealDetailView
   *
   * Responsible for generating each MealDetailView 
   */
  var MealDetailList = Backbone.View.extend({
    // Render MealDetailView[s] into this element
    el: $('#meal-detail-list'),
  

    initialize: function(){
      // Make sure all functions execute with the correct 'this'
      _.bindAll(this, 'addOne', 'addAll', 'render');
    
    
      this.collection.bind('add', this.addOne);
      this.collection.bind('refresh', this.addAll);
    
      this.collection.fetch();
    },
  
    addOne: function(meal){
      var view = new MealDetailView({model: meal});
      $(this.el).append(view.render().el);
      if($.mobile)
        $.mobile.initializePage();
    },
  
    addAll: function(){
      $(this.el).empty();
      this.collection.each(this.addOne);
    }
  });
  
  
  /**
  * Show Page
  */
  var MealDetailView = Backbone.View.extend({
    // View based on a DIV tag
    tagName: "DIV",

  
    // Use a template to interpret vakues
    template: _.template($('#meal-detail-template').html()),
  
  
    initialize: function(){
      // Make sure render is always called with this = this view
      _.bindAll(this, 'render');
    
      // Updated this div with jQuery Mobile data-role, and unique ID
      $(this.el).attr({
        'data-role': 'page',
        'id': "meal_" + this.model.id
      });
    
      // Whenever the model changes, render this view
      this.model.bind('change', this.render);
    },
  
    // Render the view into this View's element
    render: function(){
      $(this.el).html(this.template({meal: this.model}));
      return this;
    },

  });
  
    
  window.Meal = Meal;
  
  App.collections.all_meals = new MealList(null, {
    comparator: function(meal){
      return (meal.get('mealtype') || "").toLowerCase();
    }
  });
  
  App.collections.meals_distance = new MealList(null, {
    comparator: function(meal){
      return meal.distanceFromCurrent();
    }
  })
  
  App.views.new_form = new NewFormView({
    el: $('#new')
  });
  
  App.views.list_alphabetical = new MealListView({
    el: $('#all_meals'),
    collection: App.collections.all_meals
  });
  
  // Initialize View for collection of all Meal Detail pages
  App.views.meals = new MealDetailList({
    collection: App.collections.all_meals
  });
  
  // Initialize View for distance sorted listview of Meals
  App.views.list_distance = new MealListView({
    el: $('#nearest_meals'),
    collection: App.collections.meals_distance
  })
  
  // Initialize  the Nearest Page View
  App.views.nearest_page = new NearestPageView({
    el: $('#nearest'),
    listView: App.views.list_distance
  })
  
  return App;
})();




