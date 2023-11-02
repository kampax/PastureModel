# PastureModel
This pasture production model provides a map of Available Metabolic Energy (EMD) for a region in Andalusia. The model is based on the doctoral thesis of Passera Sassi (1999), where equations were calibrated using field measurements

We spatialize the model pasture production using available spatial information layers for the region, while also identifying limitations and ways to enhance these models. This was achieved using Google Earth Engine, which facilitates cloud-based processing.

We calculated available metabolic energy (EMD), by applying a series of equations from the study of Passera Sassi 1999 that relate parameters of precipitation (mm) and vegetation cover (%), where the bioclimatic floors to which each type belongs are taken into account of pasture. In the doctoral thesis (Passera Sassi 1999), the term "pasture" encompasses not only herbaceous species but also woody vegetation (shrubs and trees) that provide food for livestock and wildlife. 

The precipitation data is derived from REDIAM and the land use map comes from the Information System on the Natural Heritage of Andalusia (SIPNA) developed within REDIAM. The system brings together geographic and alphanumeric information from a series of layers at a detailed scale (1:10,000)

Here three workflows are presented to obtain available metabolic energy maps:
1) First the bioclimatic floors are defined
The maps generated correspond to the bioclimatic floors following the criteria of the work of Rivas-Martínez (1987)
The Rivas – Martínez criteria for delimiting bioclimatic floors in the Mediterranean region are the following:

|**Bioclimatic floor**|**T**|**m**|**Mn**|**IT**|**H**|
| - | - | - | - | - | - |
|**Cryoromediterranean**|< 4|< -7|< 0|< -30|I–XII|
|**Oromediterranean**|4-8|-7–-4|0-2|-30-60|I–XII|
|**Supramediterranean**|8-13|-4- -1|2-9|60-210|IX–VI|
|**Mesomediterranean**|13-17|1-4|9-14|210-350|X-IV|
|**Thermomediterranean**|17-19|4-10|14-18|350-470|XII-II|
|**Inframediterranean**|> 19|> 10|> 18|>470|No|

Where
T: Average annual temperature ºC (Source: REDIAM)
m: Average minimum temperature of the coldest month. ºC. (Source: REDIAM)
Mn: Average maximum temperature of the coldest month ºC. (Source: REDIAM)
It: Rivas-Martinez thermality index [It = (T + m + Mn) * 10]
H: Frost Period, depending on the months (in the table in Roman numerals) this variable was not computed
To assign each pixel to a bioclimatic floor, at least three of the five criteria must be met.

3) The climatic zones that present similar characteristics to the original study sites of the Thesis were calculated.
The goal of this step is to create areas of confidence where the metabolic energy map can be used with a greater degree of certainty. This layer serves to identify sites with climatic and topographic characteristics similar to the sites where the equations were calibrated. The places that are within this area have high confidence in the models since they are located in areas where the climatic characteristics are very similar to the originals sites.
__Mahalanobis distance__ is a statistical measure used to evaluate the similarity or difference between two sets of multivariate data. In this context we use the Mahalanobis distance to help determine which geographic areas have similar climate patterns to the original sites Passera studied in his doctoral thesis. This algorithm calculates the Mahalanobis distance and subsequently extracts the 90th percentile, where small distance values indicate greater environmental similarity.

4) The calculation of the available metabolic energy was made taking into account the bioclimatic floors and using the layers created in the previous step as masks.

## 1) Definition of Bioclimatic floors
## 2) Areas with climatic similarity (based on Mahalanobis distances)
## 3) Calculation of available metabolic energy
With this algorithm, Passera's equations are applied using the annual accumulated precipitation values (in mm) and grass cover values (in %). Different equations are applied depending on the type of pasture (herbaceous or shrub) and according to the bioclimatic floor where it is applied
|**Bioclimatic floor**|**type** |**code**|**n**|**R2**|<p>**Equation**</p><p></p>|
| - | - | - | - | - | - |
|Cryoromediterranean|Shrub |1|17|0\.85|z = -2253,357 + (2,916 \*P) + (76,863\* C)|
|Oromediterranean|Shrub|4|17|0\.85|z = -2253,357 + (2,916 \*P) + (76,863\* C)|
|Supramediterranean|Shrub|7|17|0\.85|z = -2253,357 + (2,916 \*P) + (76,863\* C)|
|Mesomediterranean|Shrub|11|21|0\.80|Z= -2938,221 + (0,963 \* P) + (129,819 \* C)|
|Thermomediterranean|Shrub|15|48|0\.71|Z=-2198,151 + (1,61 \* P) + (101,22 \* C)|
|Oromediterranean|Herbaceous |40|5|0\.93|Z=6069- (7.75\* P) + (73.121\*C)|

Where P is the value of the annual accumulated precipitation and C is the percentage of vegetation coverage.
The final map present this bands 
1) EMD: the available metabolic energy map cut by the imposed quality layers (Mahalanobis distance, tree cover, precipitation less than 100 mm)
2) n: a map with the n of each original model
3) r2: a map with the values of the coefficient of determination of the original models
