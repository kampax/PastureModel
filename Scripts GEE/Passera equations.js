var AnnualPrecipitation = ee.ImageCollection("users/cnav/RediamClimate/AnnualPrecipitation"),
    Andalucia = ee.FeatureCollection("users/cnav/Limites_Andalucia"),
    SitiosPassera = ee.FeatureCollection("users/cnav/SitiosPasseraPol"),
    pisos = ee.Image("users/cnav/Pisos_bioclimaticos/Pisos_Bioclimaticos"),
    Mahalanobis = ee.Image("users/cnav/PasseraTesis/MahalanobisDistance"),
    geometry = 
    /* color: #d63000 */
    /* shown: false */
    /* displayProperties: [
      {
        "type": "rectangle"
      }
    ] */
    ee.Geometry.Polygon(
        [[[-3.5823495057050025, 37.19824920879446],
          [-3.5823495057050025, 36.89573166398762],
          [-2.7501351502362525, 36.89573166398762],
          [-2.7501351502362525, 37.19824920879446]]], null, false);

Map.setOptions("SATELLITE");
var AOI = geometry;

///////////////// Define time interval //////////
var initialYear = 2009;
var finalYear = 2009;
var InitialDate = ee.Date.fromYMD(initialYear,1,1);
var FinalDate = ee.Date.fromYMD(finalYear,12,31);
var years = ee.List.sequence(initialYear,finalYear);

//////////////////////////////////////////////////
// //////////////1) Precipitation data ///////////
/////////////////////////////////////////////////

//Load the precipitation data derived from REDIAM
//https://portalrediam.cica.es/descargas?path=%2F04_RECURSOS_NATURALES%2F03_CLIMA%2F02_CARACTERIZACION_CLIMATICA%2F03_PRECIPITACION%2F01_PRECIPITACION%2F04_ANUAL%2FPRECIP_ANUAL

var Precipitation = AnnualPrecipitation
.filterDate(InitialDate,FinalDate);

// Define a function to rename the bands
var renameBands = function(image) {
  var bandNames = ['precipitation'];
  return image.rename(bandNames);
};

// Map the function over the ImageCollection to rename the bands
var Precipitation = Precipitation.map(renameBands);
//print("Precipitation betwen "+ initialYear+ "and"+ finalYear, Precipitation);

//Make a reduction of annual average values in that period 
//This is useful if you take a range of years and want to calculate the average precipitation for the period

var prec_mean=Precipitation.mean().round();

// Visualize the precipitation layer on the map
Map.addLayer(prec_mean, {min:150, max:1700, palette: ["ff1306","e4ff12","08ff28","0a1cff","b806ff"]}, "Average precipitation for Andalusia in the period 2011-2021", 0);


//////////////////////////////////////////////////
// //////////////2) Land cover data /////////////
/////////////////////////////////////////////////

// Load the layers of coverage of the rasterized sipna 
// you can select between the different versions of SIPNA by changing the year (eg 2023)
var sipna_arb = ee.Image("users/cnav/Sipna/raster/SIPNA2020_d_arb_5m");
var sipna_herb = ee.Image("users/cnav/Sipna/raster/SIPNA2020_d_herb_5m").rename("herb");
var sipna_mat = ee.Image("users/cnav/Sipna/raster/SIPNA2020_d_mat_5m").rename("mat");

//I calculate the cover value from the SIPNA using the herbaceous and scrub cover
// To avoid that the parts without data remain as without data in the sum I use unmask that fills these places with 0 using the other layer as a reference
var cobertura0 = sipna_herb.add(sipna_mat.unmask(ee.Image(0))).rename("cobertura");
var cobertura1 = sipna_mat.add(sipna_herb.unmask(ee.Image(0))).rename("cobertura");
var cobertura = ee.ImageCollection([cobertura0, cobertura1]).max();

// Create a mask based on a maximum tree cover of 20% filling with 1 where the cover layer is present
var mask_arb = sipna_arb.lt(20).rename("cobertura");
// layer with values of 1 for all coverage
var mask_cover = cobertura.gt(0).rename("cobertura");
// merged into a Feature Collection extracting the minimum value so if there is a sector with or (trees) leave it in the created mask
var mask_arb2 = ee.ImageCollection([mask_arb, mask_cover]).min();
//Map.addLayer(mask_arb2, {}, "Mask_arb", 0);

// Mask the cover layer that is the one I am going to work with based on the tree cover being less than 20%
var cobertura = cobertura.updateMask(mask_arb2);

// Visualize the LC layer on the map
//Map.addLayer(sipna_herb, {min: 1, max:100, palette: ["ff180c","faff0e","0fce0d"]}, "SIPNA grass cover", 0);
//Map.addLayer(sipna_mat, {min: 4, max:100, palette: ["ff180c","faff0e","0fce0d"]}, "SIPNA shrub cover", 0 );
Map.addLayer(cobertura, {min: 5, max:100, palette: ["ff180c","faff0e","0fce0d"]}, "SIPNA added coverage", 0 );

//////////////////////////////////////////////////
// //////////////3) Pisos bioclimaticos///////////
/////////////////////////////////////////////////

//Load the layer of "Pisos Bioclimaticos" derived from the work of Rivas-Martinez 1983
//https://revistas.ucm.es/index.php/LAZA/article/download/LAZA8383110033A/11034/0


// The download link is https://portalrediam.cica.es/descargas?path=%2F04_RECURSOS_NATURALES%2F01_BIODIVERSIDAD%2F01_VEGETACION_ECOSISTEMAS%2F04_BIOGEOGRAFIA%2FPisosBioclim_10
// The pisos have the following values 1 (Crioromediterraneo), 4 (Oromediterraneo), 7 (Supramediterraneo), 11 (Mesomediterraneo), 15 (Termomediterraneo)
//It is a layer of 10 meters of pixel resolution

//Visualize the pisos bioclimaticos layer on the map
Map.addLayer(pisos, {min:1, max:30, palette: ["ff3506", "ffed0a","0aff13","0cfeff","0e2aff"]}, "Pisos Bioclimaticos", 0);


//////////////////////////////////////////////////
/////////////////4) Join 2 y 3////////////////
//////////////////////////////////////////////////


///Join the LUCL layers (shrubland and grassland (10 and 1 respectively)) with pisos Bioclimaticos ()

var tipo = ee.Image("users/cnav/Sipna/raster/SIPNA2020_tipo_5m");

var crs = tipo.projection().getInfo();

//Reproject so that both layers have the same CRS
pisos = pisos.reproject(crs.crs, crs.transform);

var tipo_piso = pisos.multiply(tipo).round().toByte().rename('source');

//Map.addLayer(tipo_piso, {min:1, max:150}, "Tipo de pastos / piso Bioclimatico", 0);
// ///////////////////////////////////////////////////////////////////////////
// /////////////////5) Available metabolic energy calculation/////////////////
// ///////////////////////////////////////////////////////////////////////////

// //// The pisos have the following values 1 (Crioromediterraneo), 4 (Oromediterraneo), 7 (Supramediterraneo), 11 (Mesomediterraneo), 15 (Termomediterraneo)
// //The values for the SIPNA layer are 1 for shrub and 10 for grass.
//// The combination are: 1(Matorrales Crioromediterraneo), 4(Matorrales Oromediterraneo), 7 (Matorrales Supramediterraneo), 11(Matorrales Mesomediterraneo), 15(Matorrales Termomediterraneo) 
// 10 (Pastizales Crioromediterraneo), 40 (Pastizales Oromediterraneo), 70 (Pastizales Supramediterraneo), 110 (Pastizales Mesomediterraneo), 150 (Pastizales Termomediterraneo)

// //////////////////////////////
// ////MODELS VALUES////////////
// //////////////////////////////

// Based on Passera 1999
// Propuestas metodológicas para la gestión de ambientes forrajeros naturales de zonas áridas y semiáridas
//https://digibug.ugr.es/handle/10481/37511

// Equations
// Matorrales Oro y Supramediterraneo: z = -2253,357 + 2,916 x + 76,863 y
// Matorrales Mesomediterraneo: z = -2938,221 + 0,963 x + 129,819 y
// Herbazales Oromediterraneo: z = 6069-7.75*x+73.121*y
////NOT USED
// Todos los matorrales: z = 2198.151-1.61*x+ 101.22*y


// ///Dictionary with the values that enter the equations
var trat= {
  //"Todos_los_pastos":[0.269, 88.214, 701.036, tipo_piso.select("source").gt(0)], 
  "Todos_los_matorrales":[1.61, 101.22, 2198.151, tipo_piso.select("source").lt(0)],// 
  "Matorrales_oro_y_supramediterraneo":[2.916, 76.863, 2253.357, tipo_piso.select("source").eq(4).or(tipo_piso.select("source").eq(1)).or(tipo_piso.select("source").eq(7))],  
  "Matorrales_Mesomediterraneo":[0.963, 129.819, 2938.221, tipo_piso.select("source").eq(11).or(tipo_piso.select("source").eq(15))],///TERMOMEDITERRANEO ITS INCLUDED LIKE MESO
  "Herbazales_Oromediterraneo":[-7.175, 73.121, -6069.409, tipo_piso.select("source").eq(40)],
};


// print(trat, "trat");

// Function to perform the calculations

var calcEMD = function(tratCode, input){
  var val1 = trat[tratCode][(0)];
  var val2 = trat[tratCode][(1)];
  var val3 = trat[tratCode][(2)];
  
  var mask_trat = trat[tratCode][(3)];
  
  var EMD1= ((prec_mean.select(['precipitation'])).multiply(ee.Number(val1)));
  var EMD2=input.multiply(ee.Number(val2));//In input the coverage values will go or if I want to change it to NDVI
  var EMD3c=(EMD2.add(EMD1)).subtract(ee.Number(val3));
  
  var result = EMD3c.mask(mask_trat);

  return result;
};

var testing1 = calcEMD('Herbazales_Oromediterraneo', cobertura.select("cobertura"));
var testing2 = calcEMD("Todos_los_matorrales",cobertura.select("cobertura"));
var testing3 = calcEMD("Matorrales_oro_y_supramediterraneo", cobertura.select("cobertura"));
var testing4 = calcEMD("Matorrales_Mesomediterraneo", cobertura.select("cobertura"));


// Join all the partial results of each "Bioclimatic Floor" in an image queue
var EMD = ee.ImageCollection([testing1, testing2, testing3, testing4]).max().rename("EMD").round();


// //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// //////////////////////////6) EMD calculation using NDVI values///////////////////////////////////////////////////////
// /////////////////////////////////////////////////////////////////////////////////////////////////////////////////


//Function to mask clouds
function maskS2clouds(image) {
  var qa = image.select('QA60');

  // Bits 10 and 11 are clouds and cirrus, respectively.
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;

  // Both flags should be set to zero, indicating clear conditions.
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
      .and(qa.bitwiseAnd(cirrusBitMask).eq(0));

  return image.updateMask(mask).divide(10000);
}

// Apply filter and masks
var dataset = ee.ImageCollection('COPERNICUS/S2_SR')
                  //.filter(ee.Filter.or( ee.Filter.calendarRange(5, 5, 'month'), ee.Filter.calendarRange(6, 6, 'month')))
                  .filterDate('2017-09-01', '2017-10-31')
                  // Pre-filter to get less cloudy granules.
                  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE',20))
                  .map(maskS2clouds);
                  

// Function to calculate NDVI 
var ndvi_f = function(image){
  var ndvi= image.normalizedDifference(['B8', 'B4']).rename('NDVI');
  image= image.addBands(ndvi);//add the NDVI band to each image
  return image.clip(Andalucia).select('NDVI');// Cut through the study area and select only the NDVI variable
   
};

// Apply the created function
var ndviS2= dataset.map(ndvi_f);

//Calculate an average NDVI value
var ndviS2=ndviS2.mean();

// Based on regresion model
//y=α+βx 
//β=Pendiente=79.618
//α=Intercept = 44.412
// 

var ndviS2= ndviS2.expression("float(79.618* ndvi + 38.67)", {
  "ndvi":ndviS2.select("NDVI")
}).rename('NDVI');


//Add the NDVI layer
Map.addLayer(ndviS2, {min: 5, max: 100, palette:['ff180c','faff0e', '0fce0d']}, "NDVI mean 2017", 0);


// //////////////////////////////////////////////////
// /////////////////7) Calculo de EMD NDVI ////////////////
// //////////////////////////////////////////////////


// Apply the function according to the type of pasture
var testing1_v2 = calcEMD('Herbazales_Oromediterraneo', ndviS2.select("NDVI"));
var testing2_v2 = calcEMD("Todos_los_matorrales",ndviS2.select("NDVI"));
var testing3_v2 = calcEMD("Matorrales_oro_y_supramediterraneo", ndviS2.select("NDVI"));
var testing4_v2 = calcEMD("Matorrales_Mesomediterraneo", ndviS2.select("NDVI"));

//Merge the images into one
var PasturesModel_v2 = ee.ImageCollection([testing1_v2, testing2_v2, testing3_v2, testing4_v2]).median().rename("EMD");
//print('EMD image', PasturesModel_v2);

//Save layers with unmasked EMD values 
var EMDComplete = EMD.rename('EMDComplete');
var PasturesModel_v2Complete =  PasturesModel_v2.rename('EMDComplete');


//Map.addLayer(PasturesModel_v2, {min: -68, max: 10644, palette:["410eff","0ee3ff","13ff0c","dcff0c","ff0404"] }, "Available Metabolic Energy NDVI");


// ////////////////////////////////////////////////////////////////////////////
// /////////////////8) Enmascaramiento de los modelos generados////////////////
// ///////////////////////////////////////////////////////////////////////////


// It is necessary to mask the models with the tree mask created in the line 62
var PasturesModel_v2 = PasturesModel_v2.updateMask(mask_arb2);
var EMD = EMD.updateMask(mask_arb2);

//////////////////////////////////////////////////////////////////////
//Mask for areas where the coverage is less than 20%//////////////////
/////////////////////////////////////////////////////////////////////

var cob_mask = cobertura.select("cobertura").gt(20);
var prec_mask = prec_mean.select(['precipitation']).gt(150);

//Combining masks
var masks = cob_mask.multiply(prec_mask);


// Now I mask the resulting maps
var PasturesModel_v2 = PasturesModel_v2.updateMask(prec_mask);//
var EMD = EMD.updateMask(masks);

// Mahalanobis
var mahalanobisBin= ee.Image('users/cnav/PasseraTesis/MahalanobisDistance_merged').rename('mascara').toInt();
//Getting mask with binary values
mahalanobisBin = mahalanobisBin.gt(0.5);

//applying the masks
PasturesModel_v2 = PasturesModel_v2.updateMask(mahalanobisBin);
EMD = EMD.updateMask(mahalanobisBin);



// ////////////////////////////////////////////////////////////////////////////
// /////////////////9) Grado de incertidumbre en base al n y r2////////////////
// ///////////////////////////////////////////////////////////////////////////

// //// The pisos have the following values 1 (Crioromediterraneo), 4 (Oromediterraneo), 7 (Supramediterraneo), 11 (Mesomediterraneo), 15 (Termomediterraneo)
// //The values for the SIPNA layer are 1 for shrub and 10 for grass.
//// The combination are: 1(Matorrales Crioromediterraneo), 4(Matorrales Oromediterraneo), 7 (Matorrales Supramediterraneo), 11(Matorrales Mesomediterraneo), 15(Matorrales Termomediterraneo) 
// 10 (Pastizales Crioromediterraneo), 40 (Pastizales Oromediterraneo), 70 (Pastizales Supramediterraneo), 110 (Pastizales Mesomediterraneo), 150 (Pastizales Termomediterraneo)


// According to the type of coverage, I assign a value of n and then r2 associated with the model that was applied.
var oldValues = [1, 4, 7, 11,15, 10, 40, 70, 110, 150];
var newValues = [17, 17, 17, 21, 21, 0, 5, 0, 0, 0];

// Remap the raster values
var nValues = tipo_piso.remap(oldValues, newValues, null, 'source').rename("n");


///r2
var oldValues = [1,    4,      7, 11,     15, 10, 40, 70, 110, 150];
var newValues = [0.85, 0.85, 0.85, 0.80, 0.80, 0, 0.93, 0, 0,  0];// 

// Remap the raster values
var r2Values = tipo_piso.remap(oldValues, newValues, null, 'source').rename("r2");


// Add them as bands to EMD

var EMD = EMD.addBands(nValues).addBands(r2Values);
var PasturesModel_v2 = PasturesModel_v2.addBands(nValues).addBands(r2Values);



// Add the EMD layer without masking as a band

var EMD = EMD.addBands(EMDComplete);
var PasturesModel_v2 = PasturesModel_v2.addBands(PasturesModel_v2Complete);

//CLIP FOR AOI
EMD = EMD//.clip(AOI);
PasturesModel_v2 = PasturesModel_v2//.clip(AOI);


// Visualization of the resulting layers
Map.addLayer(EMD, {bands: ["EMD"], min:100, max:6822.89, palette:"410eff,0ee3ff,13ff0c,dcff0c,ff0404"}, "Available Metabolic Energy SIPNA");
Map.addLayer(PasturesModel_v2, {bands: ["EMD"], min:0, max: 10644, palette:["410eff","0ee3ff","13ff0c","dcff0c","ff0404"] }, "Available Metabolic Energy NDVI", 0);

// Add Date

// Define la fecha manualmente en el formato deseado (puedes utilizar una fecha de JavaScript)
var date = ee.Date(initialYear+'-01-01');
var date2 = ee.Date(initialYear+'-12-31');

// add properties
var EMD = EMD.set('system:time_start', date);
var EMD = EMD.set('system:time_end', date2);


/////////////////////////////////////////////////////////////////////////
/////////////////////////10) Masks Stack/////////////////////////////////
/////////////////////////////////////////////////////////////////////////


Map.addLayer(mahalanobisBin,{min:0, max:1} ,"mahalanobisBin", 0);


// First create a layer with all the masks
var mask_merged = ee.ImageCollection([mask_arb.rename('mascara'), cob_mask.rename('mascara'), 
prec_mask.rename('mascara'), mahalanobisBin.rename('mascara')]);

// Calculate the minimum so that if in any mask I take the value of 0 that pixel is masked
var mask_merged = mask_merged.min();


// var masks = mask_merged.rename('MergedMasks').addBands(mask_arb.rename('MaskTrees')).addBands(cob_mask.rename('CovLess20%'))
// .addBands(prec_mask.rename('PrecLess150%')).addBands(Mahalanobis);

var masks = mask_merged.rename('MergedMasks').addBands(mask_arb.rename('MaskTrees')).addBands(cob_mask.rename('CovLess20'))
.addBands(prec_mask.rename('PrecLess150')).addBands(Mahalanobis);
//CLIP FOR AOI
masks = masks//.clip(AOI);

Map.addLayer(masks, {min:0, max:1}, "masks", 0);





////////////////////////////////////Dictionary///////////////////////////////

//MergedMasks = 0 all masks combined
//MaskTrees = 0  Coverage of more than 20% of trees, masks forest areas
//CovLess20% = 0 Combined shrubland and grassland cover less than 20%, which gives negative EMD values
//PrecLess20% = 0 Precipitation less than 150 mm per year. Which in EMD gives negative values
//
//In all cases the values of 1 are considered valid and are not masked.

/////////////
///OUTPUTS///
/////////////

//EMD con 4 bandas EMD recortado, n values, r2 values, EMD completo
//masks con 8 bandas MergedMasks, MaskTrees, CovLess20%, PrecLess20%, y las capas con las distancias de Mahalanobis Termo, Oro, Supra, Meso

///////////////////////////////////////////////////////////
///////////12) Export the models///////////////////////////
///////////////////////////////////////////////////////////

Export.image.toAsset({
  image: EMD, 
  description: "Available_Metabolic_Energy_SIPNA2020_"+initialYear,
  assetId: "EMD/Available_Metabolic_Energy_SIPNA2020_"+initialYear,
  scale: 10,
  region:Andalucia,
  maxPixels:1e13
  });



Export.image.toAsset({
  image: masks, 
  description: "masks",
  assetId: "EMD/masks",
  scale: 10,
  region:Andalucia,
  maxPixels:1e13
  });
// Export.image.toAsset({
//   image: PasturesModel_v2, 
//   description: "Available_Metabolic_Energy_NDVI"+initialYear, 
//   assetId: "EMD/Available_Metabolic_Energy_NDVI_"+initialYear,
//   scale: 10,
//   region:Andalucia,
//   maxPixels:1e13
//   });


///////////////////////////////////////////////////////////
///////////13) Extract the values//////////////////////////
///////////////////////////////////////////////////////////

var sitios = ee.FeatureCollection("users/CarlosNavarro/SitiosPasseraPiso");
var tipo_modelo = "_2_param";


// extract the mean, median, min and max values for study area
var reducers = ee.Reducer.minMax()
  .combine({
     reducer2: ee.Reducer.mean(),
     sharedInputs: true
  })
  .combine({
    reducer2: ee.Reducer.median(),
    sharedInputs: true
  });


// Apply the reducers
var result = PasturesModel_v2.reduceRegions({
  collection: sitios,
  reducer: reducers,
  scale: 10  // Ajustar la escala 
});


// Export to drive 
Export.table.toDrive({
  collection : result, 
  description: "EMDBySitio", 
  folder: "earthengine", 
  fileNamePrefix: "EMDBySitio"+tipo_modelo, 
  });
  
  
/////////////////////////////////////

Map.addLayer(sitios, {}, "Sitios Passera", 0);

Map.centerObject(AOI, 11);

//////////////////////////////////////////////////////////////////////////////////////////
///////////////////////END OF SCRIPT//////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////////////////////////


  
