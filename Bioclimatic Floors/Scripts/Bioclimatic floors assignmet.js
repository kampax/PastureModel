var TempMin = ee.ImageCollection("users/cnav/RediamClimate/TempMinMonth"),
    TempMax = ee.ImageCollection("users/cnav/RediamClimate/TempMaxMonth"),
    TempMean = ee.ImageCollection("users/cnav/RediamClimate/TempMeanMonth"),
    Andalucia = ee.FeatureCollection("users/cnav/Limites_Andalucia"),
    pisos = ee.FeatureCollection("users/cnav/PisosBioclim_10_SN");


// Based on Rivas-Martinez https://biogeografia.net/bioclima07a.html


//********** TIME INTERVAL **********//
var startyear = 2010;
var endyear = 2015;
var data_inicial = ee.Date.fromYMD(startyear,1,1);
var data_final = ee.Date.fromYMD(endyear,12,31);
var years = ee.List.sequence(startyear,endyear);


Map.centerObject(Andalucia, 10);


/////////////////////////////////////
////////////// Variables////////////
///////////////////////////////////
var temperature=TempMean
.filterDate(data_inicial, data_final); //

//Calculate an average temperature value for the selected period
var temp_anual_mean=temperature.mean();

//Add the layer to the map
Map.addLayer(temp_anual_mean, {min:13, max:16}, "Annual mean temperature", 0);


//Select the coldest month and then calculate the average minimum temperature value
var Enero=TempMin
.filter(ee.Filter.calendarRange(1,1, 'month'))
.filterDate(data_inicial,data_final);

print(Enero, "Enero min");

//Select the coldest month and then calculate the average maximum temperature value
var Enero_max = TempMax
.filter(ee.Filter.calendarRange(1,1, 'month'))
.filterDate(data_inicial,data_final);

print(Enero_max, "Enero max");


///////////////////////////////////////////////////////////////////
////////////// Calculation of the "Thermicity" index///////////////
///////////////////////////////////////////////////////////////////
//Indice de Termicidad
//It: Índice de termicidad de Rivas-Martinez [It = (T + m + Mn) * 10]

// Respuesta rapida min y max promedio
var MeanMin = Enero.mean().toInt32();
Map.addLayer(MeanMin, {}, "Promedio de las temperaturas más bajas", 0);
print(MeanMin, "MeanMIN");
var MeanMax = Enero_max.mean().toInt32().select("b1");
print(MeanMax, "MeanMAX");

print(temp_anual_mean);

var IT= (temp_anual_mean).add(MeanMin).add(MeanMax);
var IT=IT.multiply(10);
print("Indice de termicidad", IT);

Map.addLayer(IT, {min:169, max:301}, "Indice de termicidad");
//////////////////////////////////////////////////////
///////////////PISO CRIOROMEDITERRANEO////////////////
//////////////////////////////////////////////////////
// I create criteria that it must meet and then I consider it as belonging to the apartment if it meets at least 2 of the criteria, giving greater weight to the thermal index

var cri = IT.lt(-30).multiply(2);

var max_temp_mask = MeanMax.lt(0);
var min_temp_mask = MeanMin.lt(-7);
var mean_temp_mask = temp_anual_mean.lt(4);
var masks_sum = cri.add(max_temp_mask).add(min_temp_mask).add(mean_temp_mask);
var mask_res = masks_sum.gte(3);
var crioromediterraneo = IT.updateMask(cri);

// Assign a specific value to the Piso bioclimatico
var crioromediterraneo = crioromediterraneo.where(crioromediterraneo, 1).rename("piso");

var crioro = pisos.filter(ee.Filter.eq('PISO', "Crioromediterráneo"));
Map.addLayer(crioro, {}, "Piso CriOromediterraneo fijo",0);
Map.addLayer(crioromediterraneo, {palette:["purple"]}, "Piso CriOromediterraneo raster",0);

//////////////////////////////////////////////////////
/////////////// OROMEDITERRANEO///////////////////////
//////////////////////////////////////////////////////

// //.and(MeanMax.gt(0)).and(MeanMax.lt(2)).and(MeanMin.gt(-7)).and(MeanMin.lt(-4)).and(temp_anual_mean.gt(4)).and(temp_anual_mean.lt(8));
// 
var orom = IT.gt(-30).and(IT.lt(60)).multiply(2);
var max_temp_mask = MeanMax.gt(0).and(MeanMax.lt(2));
var min_temp_mask = MeanMin.gt(-7).and(MeanMin.lt(-4));
var mean_temp_mask = temp_anual_mean.gt(4).and(temp_anual_mean.lt(8));
var masks_sum = orom.add(max_temp_mask).add(min_temp_mask).add(mean_temp_mask);
var mask_res = masks_sum.gte(3);
var oromediterraneo = IT.updateMask(mask_res);

// Assign a specific value to the Piso bioclimatico
var oromediterraneo = oromediterraneo.where(oromediterraneo, 4).rename("piso");
//To compare, load the corresponding piso of the REDIAM shape
var oro = pisos.filter(ee.Filter.eq('PISO', "Oromediterráneo"));
Map.addLayer(oro, {}, "Piso Oromediterraneo fijo",0);
Map.addLayer(oromediterraneo, {palette:["blue"]}, "Piso Oromediterraneo raster",0);

//////////////////////////////////////////////////////
/////////////// SUPRAMEDITERRANEO/////////////////////
//////////////////////////////////////////////////////

var sup = IT.gt(60).and(IT.lt(210)).multiply(2);
//.and(MeanMax.gt(2)).and(MeanMax.lt(9)).and(MeanMin.gt(-4)).and(MeanMin.lt(1)).and(temp_anual_mean.gt(8)).and(temp_anual_mean.lt(13));
var max_temp_mask = MeanMax.gt(2).and(MeanMax.lt(9));
var min_temp_mask = MeanMin.gt(-4).and(MeanMin.lt(1));
var mean_temp_mask = temp_anual_mean.gt(8).and(temp_anual_mean.lt(13));
var masks_sum = sup.add(max_temp_mask).add(min_temp_mask).add(mean_temp_mask);
var mask_res = masks_sum.gte(3);
var supramediterraneo = IT.updateMask(mask_res);

// Assign a specific value to the Piso bioclimatico
var supramediterraneo = supramediterraneo.where(supramediterraneo, 7).rename("piso");

//To compare, load the corresponding piso of the REDIAM shape
var supra = pisos.filter(ee.Filter.eq('PISO', "Supramediterráneo"));
Map.addLayer(supra, {}, "Piso Supramediterraneo fijo",0);
Map.addLayer(supramediterraneo, {palette:["green"]}, "Piso Supramediterraneo raster", 0);

//////////////////////////////////////////////////////
/////////////// MESOMEDITERRANEO//////////////////////
//////////////////////////////////////////////////////

var mes = IT.gt(210).and(IT.lt(350)).multiply(2);
//.and(MeanMax.gt(9)).and(MeanMax.lt(14)).and(MeanMin.gt(1)).and(MeanMin.lt(4)).and(temp_anual_mean.gt(13)).and(temp_anual_mean.lt(17));
var max_temp_mask = MeanMax.gt(9).and(MeanMax.lt(14));
var min_temp_mask = MeanMin.gt(1).and(MeanMin.lt(4));
var mean_temp_mask = temp_anual_mean.gt(13).and(temp_anual_mean.lt(17));
var masks_sum = mes.add(max_temp_mask).add(min_temp_mask).add(mean_temp_mask);
var mask_res = masks_sum.gte(2);
var mesomediterraneo = IT.updateMask(mask_res);

// Assign a specific value to the Piso bioclimatico

var mesomediterraneo = mesomediterraneo.where(mesomediterraneo, 11).rename("piso");
//To compare, load the corresponding piso of the REDIAM shape
var meso = pisos.filter(ee.Filter.eq('PISO', "Mesomediterráneo"));
Map.addLayer(meso, {}, "Piso Mesomediterraneo fijo",0);
Map.addLayer(mesomediterraneo, {palette:["red"]}, "Piso Mesomediterraneo raster", 0);

//////////////////////////////////////////////////////
/////////////// TERMOMEDITERRANEO/////////////////////
//////////////////////////////////////////////////////

var ter = IT.gt(350).and(IT.lt(470)).multiply(2);
//.and(MeanMax.gt(14)).and(MeanMax.lt(18)).and(MeanMin.gt(4)).and(MeanMin.lt(10)).and(temp_anual_mean.gt(17)).and(temp_anual_mean.lt(19));
var max_temp_mask = MeanMax.gt(14).and(MeanMax.lt(18));
var min_temp_mask = MeanMin.gt(4).and(MeanMin.lt(10));
var mean_temp_mask = temp_anual_mean.gt(17).and(temp_anual_mean.lt(19));
var masks_sum = ter.add(max_temp_mask).add(min_temp_mask).add(mean_temp_mask);
var mask_res = masks_sum.gte(3);
var termomediterraneo = IT.updateMask(mask_res);

//  Assign a specific value to the Piso bioclimatico
var termomediterraneo = termomediterraneo.where(termomediterraneo, 15).rename("piso"); 
//To compare, load the corresponding piso of the REDIAM shape
var termo = pisos.filter(ee.Filter.eq('PISO', "Termomediterráneo"));
Map.addLayer(termo, {}, "Piso Termomediterraneo fijo",0);
Map.addLayer(termomediterraneo, {palette:["darkred"]}, "Piso Termomediterraneo raster", 0);

/////////////////////////////////////////////////////////////////////////////////////
////Join all////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////

var pisos_bioclimaticos = ee.ImageCollection([crioromediterraneo, oromediterraneo, supramediterraneo,mesomediterraneo,termomediterraneo]).mosaic();

Map.addLayer(pisos_bioclimaticos, {min:1, max:15, palette:["ff450c","ffee0c","0fc036","0237ff","c602c8"]}, "Pisos joined");

/////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////EXPORT///////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////


Export.image.toDrive({
  image:pisos_bioclimaticos,
  description: "PisoBioclimatico_1970-1975",
  folder:"GEE",
  region: Andalucia,
  scale:100
})

Export.image.toAsset({
  image:pisos_bioclimaticos,
  description: "PisoBioclimatico_1970-1975",
  region: Andalucia,
  scale:100
})