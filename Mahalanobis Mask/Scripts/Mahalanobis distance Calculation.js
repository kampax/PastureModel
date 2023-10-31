var DEM = ee.Image("USGS/SRTMGL1_003"),
    Andalucia = ee.FeatureCollection("users/cnav/Limites_Andalucia"),
    sitiosPassera2 = ee.FeatureCollection("users/CarlosNavarro/SitiosPasseraPiso"),
    AnnualEvapotranspiration = ee.ImageCollection("users/cnav/RediamClimate/AnnualEvapotranspiration"),
    AnnualPrecipitation = ee.ImageCollection("users/cnav/RediamClimate/AnnualPrecipitation"),
    AnnualTempMean = ee.ImageCollection("users/cnav/RediamClimate/TempMeanAnnual");

// Mahalanobis masks



print(sitiosPassera2);

// The idea is to create an ecological space representative of the 
//original measurement sites using similar climatic and elevation characteristics.

// First you have to define the spaces that have the same characteristics as the Passera sites 

var DEM = DEM.clip(Andalucia);

/* To compare with the table that summarizes the climatic characteristics 
of each site where Passera has taken the data and the available 
climatic information grouped the data annually*/

var startDate = '1971-01-01';
var endDate = '2020-01-01';

var AnnualEvapotranspiration = AnnualEvapotranspiration.filterDate(startDate, endDate);
var AnnualPrecipitation = AnnualPrecipitation.filterDate(startDate, endDate);
var AnnualTempMean = AnnualTempMean.filterDate(startDate, endDate);


//////////////////////////////////////////////777//////////////////////////////////////////
//2) Create an annual average of temperature and precipitation based on the monthly historical averages
///////////////////////////////////////////////////////////////////////////////////////////
var InterannualpromedioTemp = AnnualTempMean.mean().rename("Temperature").toInt();//REDIAM
var InterannualpromedioPrec = AnnualPrecipitation.mean().rename("Precipitation").toInt();//REDIAM
var InteranualpromedioEvapo = AnnualEvapotranspiration.mean().rename('Evapotranspiration').toInt();//REDIAM

Map.addLayer(InteranualpromedioEvapo, {min:163, max:1632, palette: ["ff4810","ffe208","27c60b","0853ff"]}, "Average Potencial Evapotranspiration Rediam", 0);
Map.addLayer(InterannualpromedioTemp, {min:3, max:20}, "Average Temperature REDIAM", 0);
Map.addLayer(InterannualpromedioPrec, {min:163, max:1632, palette: ["ff4810","ffe208","27c60b","0853ff"]}, "Average Precipitation REDIAM", 0);
Map.addLayer(DEM, {min: 0, max:2662}, "Elevation", 0);



///////////////////////////
// 3) MAHALANOBIS DISTANCE
////////////////////////////


// The variables that should be used are:
// a) average historical precipitation
// b) historical average temperature
// c) digital elevation model
// d) evapotranspiration 



// Have to do it for each site



////////////////////////////////////////////////////////////////
///////////////////////1 OROMEDITERRANEO////////////////////////////////    
////////////////////////////////////////////////////////////////

// Select one site
var sitio = sitiosPassera2.filter(ee.Filter.eq("PISO", "Oromediterráneo"));


// Use a raster of the study area in this case based on the existing raster of environmental variables
var rast = InterannualpromedioPrec.clip(sitio).multiply(0).add(4).rename("PISO");

// First I put the environmental variables as bands in a single image
var ambientales = DEM.addBands(InterannualpromedioTemp).addBands(InterannualpromedioPrec).addBands(InteranualpromedioEvapo)
// Then I clip to the site
var ambientales_sitio =  ambientales.clip(sitio);
// Add the raster corresponding to each site as a band
var inputfeatsitio = ambientales_sitio.addBands(rast);
print("Variables ambientales", ambientales);

// Create vectors within the site
var vectors = inputfeatsitio.reduceToVectors({
  geometry: Andalucia,
  //crs: nl2012.projection(),
  scale: 500,
  geometryType: 'polygon',
  eightConnected: false,
  //labelProperty: 'Sitio',
  reducer: ee.Reducer.mean()
});

//print("Vectors",vectors);
//Map.addLayer(vectors)

var clust1lablist = vectors.aggregate_array('PISO').distinct();
//print("clust1lablist", clust1lablist);

// Take only one of the categories
var clust1lab = clust1lablist.get(0);
//print("Clustlab",clust1lab);

var clust1 = vectors.filter(ee.Filter.eq('PISO',clust1lab));
print("clust1",clust1);

var clustOro = clust1;



// sample the environmental variables
var sample_clust1 = inputfeatsitio.sample({
  region: clust1,

  // Default (false) is no geometries in the output.
  // When set to true, each feature has a Point geometry at the center of the
  // image pixel.
  geometries: true,

  // The scale is not specified, so the resolution of the image will be used,
  // and there is a feature for every pixel. If we give a scale parameter, the
  // image will be resampled and there will be more or fewer features.
  //
  scale: 500,
});

// Create the function with the classifier using the Mahalanobis distance 
var classifier_class = ee.Classifier.minimumDistance({metric:'mahalanobis'}).train({
            features:sample_clust1, //training_multiclass,
            classProperty:'PISO',
            inputProperties:ambientales.bandNames()
        });
// Apply it to the environmental variables of all Andalusia
var clf_res = ambientales.classify(classifier_class);
var clf_dist = ambientales.classify(classifier_class.setOutputMode('REGRESSION')).clip(Andalucia);



// To check the values that the layer takes
print(ui.Chart.image.histogram({
		image: clf_dist,
	region: Andalucia,
  scale: 5000,
//	maxBuckets:,
//	minBucketWidth:,
//	maxRaw:,
//	maxPixels:,
}));


// Calculate the 90th percentile to stay only with regions with smaller Mahalanobis distance
var perc90 = clf_dist.clip(clust1).reduceRegion({
  reducer:ee.Reducer.percentile([95]),
  geometry:Andalucia.geometry(),
  scale:500,
  maxPixels:1e15,
  tileScale:4
}).get('classification');

//print('90th MH percentile is ',perc90);


var mask_90 = clf_dist.lte(ee.Number(perc90));

// Add Layers
Map.addLayer(sitio, {color:"blue"}, "Piso Oromediterraneo");
Map.addLayer(clf_dist.updateMask(mask_90), {"opacity":1,"bands":["classification"],"min":1.1304413046174253,"max":5.005923476794379,"palette":["ff5825","e6ff18","24ff16","14f4ff","1d44ff"]}, 'Mahalonobis Distance Masked 90th Oromediterraneo');
Map.addLayer(clf_dist,  {"opacity":1,"bands":["classification"],"min":1.1304413046174253,"max":5.005923476794379,"palette":["ff5825","e6ff18","24ff16","14f4ff","1d44ff"]}, 'Mahalonobis Distance NO Masked 90th',0);

var Oromediterraneo = clf_dist.updateMask(mask_90);
var Oro = clf_dist; 


// // //////////////////////////////////////////////////////////////
// // ///////////////////////2 Mesomediterraneo////////////////////////////////    
// // //////////////////////////////////////////////////////////////


var sitio = sitiosPassera2.filter(ee.Filter.eq("PISO", "Mesomediterráneo"));


// Use a raster of the study area in this case based on the existing raster of environmental variables
var rast = InterannualpromedioPrec.clip(sitio).multiply(0).add(4).rename("PISO");

// First I put the environmental variables as bands in a single image
var ambientales = InterannualpromedioTemp.addBands(InterannualpromedioPrec).addBands(DEM);
// Then I clip to the site
var ambientales_sitio =  ambientales.clip(sitio);
// Add the raster corresponding to each site as a band
var inputfeatsitio = ambientales_sitio.addBands(rast);
print("Variables ambientales", ambientales);

// Create vectors within the site
var vectors = inputfeatsitio.reduceToVectors({
  geometry: Andalucia,
  //crs: nl2012.projection(),
  scale: 500,
  geometryType: 'polygon',
  eightConnected: false,
  //labelProperty: 'Sitio',
  reducer: ee.Reducer.mean(),
  maxPixels:1e13
});


//print("Vectors",vectors);
//Map.addLayer(vectors)

var clust1lablist = vectors.aggregate_array('PISO').distinct();
//print("clust1lablist", clust1lablist);

// Take only one of the categories
var clust1lab = clust1lablist.get(0);
//print("Clustlab",clust1lab);

var clust1 = vectors.filter(ee.Filter.eq('PISO',clust1lab));
print("clust1",clust1);

var clustMeso = clust1

// sample the environmental variables
var sample_clust1 = inputfeatsitio.sample({
  region: clust1,

  // Default (false) is no geometries in the output.
  // When set to true, each feature has a Point geometry at the center of the
  // image pixel.
  geometries: true,

  // The scale is not specified, so the resolution of the image will be used,
  // and there is a feature for every pixel. If we give a scale parameter, the
  // image will be resampled and there will be more or fewer features.
  //
  scale: 500,
});

// Create the function with the classifier using the Mahalanobis distance 
var classifier_class = ee.Classifier.minimumDistance({metric:'mahalanobis'}).train({
            features:sample_clust1, //training_multiclass,
            classProperty:'PISO',
            inputProperties:ambientales.bandNames()
        });
// Apply it to the environmental variables of all Andalusia
var clf_res = ambientales.classify(classifier_class);
var clf_dist = ambientales.classify(classifier_class.setOutputMode('REGRESSION')).clip(Andalucia);



// To check the values that the layer takes
print(ui.Chart.image.histogram({
		image: clf_dist,
	region: Andalucia,
  scale: 5000
}));


// Calculate the 90th percentile to stay only with regions with smaller Mahalanobis distance
var perc90 = clf_dist.clip(clust1).reduceRegion({
  reducer:ee.Reducer.percentile([95]),
  geometry:Andalucia.geometry(),
  scale:100,
  maxPixels:1e15,
  tileScale:4
}).get('classification');

//print('90th MH percentile is ',perc90);


var mask_90 = clf_dist.lte(ee.Number(perc90));

// Add Layers
Map.addLayer(sitio, {color:"red"}, "Piso Mesomediterráneo");
Map.addLayer(clf_dist.updateMask(mask_90), {"opacity":1,"bands":["classification"],"min":1.1304413046174253,"max":5.005923476794379,"palette":["ff5825","e6ff18","24ff16","14f4ff","1d44ff"]}, 'Mahalonobis Distance Masked 90th Mesomediterraneo');
Map.addLayer(clf_dist,  {"opacity":1,"bands":["classification"],"min":1.1304413046174253,"max":5.005923476794379,"palette":["ff5825","e6ff18","24ff16","14f4ff","1d44ff"]}, 'Mahalonobis Distance NO Masked 90th',0);

var Mesomediterraneo = clf_dist.updateMask(mask_90);
var Meso = clf_dist;


// // //////////////////////////////////////////////////////////////
// // ///////////////////////3 Supramediterraneo////////////////////    
// // //////////////////////////////////////////////////////////////


var sitio = sitiosPassera2.filter(ee.Filter.eq("PISO", "Supramediterráneo"));

// Use a raster of the study area in this case based on the existing raster of environmental variables
var rast = InterannualpromedioPrec.clip(sitio).multiply(0).add(4).rename("PISO");

// First I put the environmental variables as bands in a single image
var ambientales = InterannualpromedioTemp.addBands(InterannualpromedioPrec).addBands(DEM);
// Then I clip to the site
var ambientales_sitio =  ambientales.clip(sitio);
// Add the raster corresponding to each site as a band
var inputfeatsitio = ambientales_sitio.addBands(rast);
print("Variables ambientales", ambientales);

// Create vectors within the site
var vectors = inputfeatsitio.reduceToVectors({
  geometry: Andalucia,
  //crs: nl2012.projection(),
  scale: 500,
  geometryType: 'polygon',
  eightConnected: false,
  //labelProperty: 'Sitio',
  reducer: ee.Reducer.mean()
});

//print("Vectors",vectors);

var clust1lablist = vectors.aggregate_array('PISO').distinct();
//print("clust1lablist", clust1lablist);

// Take only one of the categories
var clust1lab = clust1lablist.get(0);
//print("Clustlab",clust1lab);

var clust1 = vectors.filter(ee.Filter.eq('PISO',clust1lab));
print("clust1",clust1);

var clustSupra = clust1; 

// sample the environmental variables
var sample_clust1 = inputfeatsitio.sample({
  region: clust1,

  // Default (false) is no geometries in the output.
  // When set to true, each feature has a Point geometry at the center of the
  // image pixel.
  geometries: true,

  // The scale is not specified, so the resolution of the image will be used,
  // and there is a feature for every pixel. If we give a scale parameter, the
  // image will be resampled and there will be more or fewer features.
  //
  scale: 500,
});

// Create the function with the classifier using the Mahalanobis distance 
var classifier_class = ee.Classifier.minimumDistance({metric:'mahalanobis'}).train({
            features:sample_clust1, //training_multiclass,
            classProperty:'PISO',
            inputProperties:ambientales.bandNames()
        });
// Apply it to the environmental variables of all Andalusia
var clf_res = ambientales.classify(classifier_class);
var clf_dist = ambientales.classify(classifier_class.setOutputMode('REGRESSION')).clip(Andalucia);



// To check the values that the layer takes
print(ui.Chart.image.histogram({
		image: clf_dist,
	region: Andalucia,
  scale: 5000
}));


// Calculate the 90th percentile to stay only with regions with smaller Mahalanobis distance
var perc90 = clf_dist.clip(clust1).reduceRegion({
  reducer:ee.Reducer.percentile([95]),
  geometry:Andalucia.geometry(),
  scale:500,
  maxPixels:1e15,
  tileScale:4
}).get('classification');

//print('90th MH percentile is ',perc90);


var mask_90 = clf_dist.lte(ee.Number(perc90));

// Add Layers
Map.addLayer(sitio, {color:"white"}, "Piso Supramediterraneo");
Map.addLayer(clf_dist.updateMask(mask_90), {"opacity":1,"bands":["classification"],"min":1.1304413046174253,"max":5.005923476794379,"palette":["ff5825","e6ff18","24ff16","14f4ff","1d44ff"]}, 'Mahalonobis Distance Masked 90th Supramediterraneo');
Map.addLayer(clf_dist,  {"opacity":1,"bands":["classification"],"min":1.1304413046174253,"max":5.005923476794379,"palette":["ff5825","e6ff18","24ff16","14f4ff","1d44ff"]}, 'Mahalonobis Distance NO Masked 90th',0);

var Supramediterraneo = clf_dist.updateMask(mask_90);

var Supra = clf_dist; 

// // //////////////////////////////////////////////////////////////
// // ///////////////////////4 Termomediterraneo////////////////////    
// // //////////////////////////////////////////////////////////////


var sitio = sitiosPassera2.filter(ee.Filter.eq("PISO", "Termomediterráneo"));


// Use a raster of the study area in this case based on the existing raster of environmental variables
var rast = InterannualpromedioPrec.clip(sitio).multiply(0).add(4).rename("PISO");

// First I put the environmental variables as bands in a single image
var ambientales = InterannualpromedioTemp.addBands(InterannualpromedioPrec).addBands(DEM);
// Then I clip to the site
var ambientales_sitio =  ambientales.clip(sitio);
// Add the raster corresponding to each site as a band
var inputfeatsitio = ambientales_sitio.addBands(rast);
print("Variables ambientales", ambientales);

// Create vectors within the site
var vectors = inputfeatsitio.reduceToVectors({
  geometry: Andalucia,
  //crs: nl2012.projection(),
  scale: 500,
  geometryType: 'polygon',
  eightConnected: false,
  //labelProperty: 'Sitio',
  reducer: ee.Reducer.mean()
});

//print("Vectors",vectors);
//Map.addLayer(vectors)

var clust1lablist = vectors.aggregate_array('PISO').distinct();
//print("clust1lablist", clust1lablist);

// Take only one of the categories
var clust1lab = clust1lablist.get(0);
//print("Clustlab",clust1lab);

var clust1 = vectors.filter(ee.Filter.eq('PISO',clust1lab));
print("clust1",clust1);

// sample the environmental variables
var sample_clust1 = inputfeatsitio.sample({
  region: clust1,

  // Default (false) is no geometries in the output.
  // When set to true, each feature has a Point geometry at the center of the
  // image pixel.
  geometries: true,

  // The scale is not specified, so the resolution of the image will be used,
  // and there is a feature for every pixel. If we give a scale parameter, the
  // image will be resampled and there will be more or fewer features.
  //
  scale: 500,
});

// Create the function with the classifier using the Mahalanobis distance 
var classifier_class = ee.Classifier.minimumDistance({metric:'mahalanobis'}).train({
            features:sample_clust1, //training_multiclass,
            classProperty:'PISO',
            inputProperties:ambientales.bandNames()
        });
// Apply it to the environmental variables of all Andalusia
var clf_res = ambientales.classify(classifier_class);
var clf_dist = ambientales.classify(classifier_class.setOutputMode('REGRESSION')).clip(Andalucia);



// To check the values that the layer takes
print(ui.Chart.image.histogram({
		image: clf_dist,
	region: Andalucia,
  scale: 5000
}));


// Calculate the 90th percentile to stay only with regions with smaller Mahalanobis distance
var perc90 = clf_dist.clip(clust1).reduceRegion({
  reducer:ee.Reducer.percentile([95]),
  geometry:Andalucia.geometry(),
  scale:500,
  maxPixels:1e15,
  tileScale:4
}).get('classification');

print('90th MH percentile is ',perc90);


var mask_90 = clf_dist.lte(ee.Number(perc90));

// Add Layers
Map.addLayer(sitio, {color:"green"}, "Piso Termomediterraneo");
Map.addLayer(clf_dist.updateMask(mask_90), {"opacity":1,"bands":["classification"],"min":1.1304413046174253,"max":5.005923476794379,"palette":["ff5825","e6ff18","24ff16","14f4ff","1d44ff"]}, 'Mahalonobis Distance Masked 90th Termomediterraneo');
Map.addLayer(clf_dist,  {"opacity":1,"bands":["classification"],"min":1.1304413046174253,"max":5.005923476794379,"palette":["ff5825","e6ff18","24ff16","14f4ff","1d44ff"]}, 'Mahalonobis Distance NO Masked 90th',0);

var Termomediterraneo = clf_dist.updateMask(mask_90);
var Termo = clf_dist;

var Oromediterraneo_Esc = (Oromediterraneo.unitScale(0.9466421249532265, 2.4882039091210144));
var Mesomediterraneo_Esc = Mesomediterraneo.unitScale(0.2124512801228815, 2.5021509240691513);
var Supramediterraneo_Esc = Supramediterraneo.unitScale(0.23534113017175987, 2.5023004928548023)//0.679555402965064, 2.2791087413435642)
var Termomediterraneo_Esc = Termomediterraneo.unitScale(0.0882055345407151, 2.3280798840342483);

Map.addLayer(Supramediterraneo_Esc, {}, "Termomediterraneo_Esc", 0);



Export.image.toAsset({
  image:Termo, 
  description:"Termomediterraneo_Mahalanobis", 
  assetId: 'users/cnav/PasseraTesis/Termomediterraneo', 
  region:Andalucia, 
  scale:30,
  maxPixels: 1e13 
  });
  
  
Export.table.toAsset({
  collection:clustSupra, 
  description:"clustSupra", 
  assetId: 'users/cnav/PasseraTesis/clustSupra'
  });
  

Export.table.toAsset({
  collection:clustOro, 
  description:"clustOro", 
  assetId: 'users/cnav/PasseraTesis/clustOro'
  });
  
Export.table.toAsset({
  collection:clustMeso, 
  description:"clustMeso", 
  assetId: 'users/cnav/PasseraTesis/clustMeso'
  });
  