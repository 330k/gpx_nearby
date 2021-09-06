let shoplist = [];

importScripts("data/yahoo_0205001.js")
//importScripts("data/yahoo_0304001.js")
//importScripts("data/yahoo_0307003.js")
importScripts("data/wikipedia_roadstation.js")
//importScript("data/osm_japan_convenience_001.js")
//importScript("data/mlit.js")

/**
 * 店舗データ読み込み完了コールバック
 */
function loaddata(data){
  shoplist = shoplist.concat(data);
  console.log("loaded: " + data.length);
}

/**
 * GPXファイルが選択された→ルート沿いのコンビニを探索表示
 */
onmessage = function(e){
  try{
    let coursepoints = e.data.coursepoints;
    const course_deviation_threshold = e.data.course_deviation_threshold;
    
    console.time("refineCourseData");
    coursepoints = refineCourseData(coursepoints);
    console.timeEnd("refineCourseData");
    
    console.time("reduceCoursePoints");
    //coursepoints = reduceCoursePoints(coursepoints, 1);
    console.timeEnd("reduceCoursePoints");
    console.log("reduced course points: " + coursepoints.length);
    
    console.time("getGPXBoundary");
    const boundary = getGPXBoundary(coursepoints);
    console.timeEnd("getGPXBoundary");
    
    // 矩形領域で大雑把に絞り込む
    console.time("getShopListInRect");
    const shoplist2 = getShopListInRect(shoplist, boundary, course_deviation_threshold);
    console.timeEnd("getShopListInRect");
    console.log("shops in rough rect boundary: " + shoplist2.length);
    
    console.time("getNearbyShops");
    const list = getNearbyShops(coursepoints, boundary, shoplist2, course_deviation_threshold, 10000);
    console.timeEnd("getNearbyShops");
    console.log("found shops: " + list.length);
    //console.log(list);
    
    postMessage(list);
    
  }catch(err){
    console.error(err);
    postMessage(null);
    
  }finally{
  }
}

/**
 * コースデータに計算に必要なデータを追加
 * @param {XMLDocument} gpx
 * @return {[{lat:number,lon:number,dist:number}]}
 */
function refineCourseData(coursepoints){
  const result = [];
  let coursedist = 0.0;
  
  for(let i = 0; i < coursepoints.length; i++){
    const lat = coursepoints[i].lat;
    const lon = coursepoints[i].lon;
    const XYZ = latlon2XYZ(lat, lon);
    if(i > 0){
      coursedist += hubeny(coursepoints[i - 1].lat, coursepoints[i - 1].lon, lat, lon);
    }
    
    result.push({
      "index": i,
      "lat": lat,
      "lon": lon,
      "dist": coursedist,
      "X": XYZ.X,
      "Y": XYZ.Y,
      "Z": XYZ.Z,
    });
  }
  
  return result;
}

/**
 * 3次元Douglas-Peuckerでコースの点を間引く
 * @param {[{lat:number,lon:number}]} coursepoints コースデータ
 * @param {number} threshold 許容誤差[m]
 * @return {[{lat:number,lon:number}]} 間引かれたコースデータ
 */
function reduceCoursePoints(coursepoints, threshold){
  const reducepoints = function(start, end){
    let maxdist = 0.0;
    let maxindex = 0;
    
    for(let i = start + 1; i < end; i++){
      const dist = segmentPointDistance3D(
        coursepoints[start].X, coursepoints[start].Y, coursepoints[start].Z,
        coursepoints[end].X, coursepoints[end].Y, coursepoints[end].Z,
        coursepoints[i].X, coursepoints[i].Y, coursepoints[i].Z
      ).dist;
      
      if(dist > maxdist){
        maxdist = dist;
        maxindex = i;
      }
    }
    
    if(maxdist > threshold){
      resultindexes[maxindex] = true;
      if(start + 1 < maxindex){
        reducepoints(start, maxindex);
      }
      if(maxindex + 1 < end){
        reducepoints(maxindex, end);
      }
    }
  };
  
  const resultindexes = [];
  resultindexes.length = coursepoints.length;
  resultindexes[0] = true;
  resultindexes[coursepoints.length - 1] = true;
  
  reducepoints(0, coursepoints.length - 1);
  
  const result = [];
  for(let i = 0; i < resultindexes.length; i++){
    if(resultindexes[i]){
      result.push(coursepoints[i]);
    }
  }
  return result;
}

/**
 * GPXデータの緯度経度の領域を調べる
 * @param {[{lat:number,lon:number}]} coursepoints コースデータ
 * @return {{minlat:number,maxlat:number,minlon:number,maxlon:number}} 矩形領域
 */
function getGPXBoundary(coursepoints){
  let minlat = 90.0;
  let maxlat = -90.0;
  let minlon = 180.0;
  let maxlon = -180.0;
  
  for(const pt of coursepoints){
    let lat = pt.lat;
    let lon = pt.lon;
    
    if(lat < minlat){ minlat = lat; }
    if(lat > maxlat){ maxlat = lat; }
    if(lon < minlon){ minlon = lon; }
    if(lon > maxlon){ maxlon = lon; }
  }
  
  return {
    "minlat": minlat,
    "maxlat": maxlat,
    "minlon": minlon,
    "maxlon": maxlon
  };
}

/**
 * 店舗データを緯度経度で大雑把に絞り込む
 * @param {[{id:string,lat:number,lon:number,name:string}]} shoplist 店舗リスト
 * @param {{minlat:number,maxlat:number,minlon:number,maxlon:number}} boundary 矩形領域
 * @param {number} course_deviation_threshold 許容誤差 [m]
 * @return
 */
function getShopListInRect(shoplist, boundary, course_deviation_threshold){
  const latthreshold = course_deviation_threshold * 9e-6;
  const lonthreshold = course_deviation_threshold * 9e-6 / Math.cos(boundary.maxlat * Math.PI / 180);
  const minlat = boundary.minlat - latthreshold;
  const maxlat = boundary.maxlat + latthreshold;
  const minlon = boundary.minlon - lonthreshold;
  const maxlon = boundary.maxlon + lonthreshold;
  
  return shoplist.filter((shop) => (
    (minlat < shop.lat) && (shop.lat < maxlat) && (minlon < shop.lon) && (shop.lon < maxlon)
  ));
}

/**
 * 近傍の店舗を抜き出す
 * @param {[{lat:number,lon:number}]} coursepoints コースデータ
 * @param {{minlat:number,maxlat:number,minlon:number,maxlon:number}} boundary 矩形領域
 * @param {[{id:string,lat:number,lon:number,name:string}]} shoplist 店舗リスト
 * @param {number} course_deviation_threshold コース-施設間の許容距離[m]
 * @param {number} course_between_threshold 同一の施設を別物として追加するコース距離[m]
 * @return {[{coursedist:number,lat:number,lon:number,pointdist:number,name:string}]} コース距離順に並べられた近隣店舗リスト
 */
function getNearbyShops(coursepoints, boundary, shoplist, course_deviation_threshold, course_between_threshold){
  const shops_tmp = new Map();
  
  // Cell Lists Algorithm - 各線分の位置を整数個のcellに分類
  const cell = {}; // 疎になるので配列ではなくハッシュテーブルにする
  const dlon = course_deviation_threshold * 9e-6 / Math.cos(boundary.maxlat * Math.PI / 180); // 経度方向のほうが必ず緯度方向よりも大きくなるので、経度を採用
  
  for(let i = 0; i < coursepoints.length - 1; i++){
    const m1 = Math.floor((coursepoints[i].lat - boundary.minlat) / dlon);
    const n1 = Math.floor((coursepoints[i].lon - boundary.minlon) / dlon);
    const m2 = Math.floor((coursepoints[i + 1].lat - boundary.minlat) / dlon);
    const n2 = Math.floor((coursepoints[i + 1].lon - boundary.minlon) / dlon);
      
    for(let j = Math.min(m1, m2); j <= Math.max(m1, m2); j++){
      for(let k = Math.min(n1, n2); k <= Math.max(n1, n2); k++){
        if(!cell[j]){
          cell[j] = {};
        }
        if(!cell[j][k]){
          cell[j][k] = [];
        }
        cell[j][k].push([coursepoints[i], coursepoints[i + 1]]);
      }
    }
  }
  
  // 各店舗に対してコース上の最近傍点を探索する
  for(const shop of shoplist){
    // 各店舗の緯度経度を地心直交座標系に変換
    const XYZ = latlon2XYZ(shop.lat, shop.lon);
    
    let intervals = [];
    
    {
      // Cell Listから候補となる線分を抜き出す
      
      // ソート済みの配列から重複を除きながらマージする
      const merge = function(a, b){
        let i = 0;
        let j = 0;
        const result = [];
        
        while((i < a.length) && (j < b.length)){
          if(a[i][0].index < b[j][0].index){
            result.push(a[i]);
            i++;
          }else if(a[i][0].index > b[j][0].index){
            result.push(b[j]);
            j++;
          }else{
            result.push(a[i]);
            i++;
            j++;
          }
        }
        for(i = i; i < a.length; i++){
          result.push(a[i]);
        }
        for(j = j; j < b.length; j++){
          result.push(b[j]);
        }
        
        return result;
      };
      
      const m = Math.floor((shop.lat - boundary.minlat) / dlon);
      const n = Math.floor((shop.lon - boundary.minlon) / dlon);
      
      if(cell[m - 1]){
        if(cell[m - 1][n - 1]){ intervals = merge(intervals, cell[m - 1][n - 1]); }
        if(cell[m - 1][n    ]){ intervals = merge(intervals, cell[m - 1][n    ]); }
        if(cell[m - 1][n + 1]){ intervals = merge(intervals, cell[m - 1][n + 1]); }
      }
      if(cell[m    ]){
        if(cell[m    ][n - 1]){ intervals = merge(intervals, cell[m    ][n - 1]); }
        if(cell[m    ][n    ]){ intervals = merge(intervals, cell[m    ][n    ]); }
        if(cell[m    ][n + 1]){ intervals = merge(intervals, cell[m    ][n + 1]); }
      }
      if(cell[m + 1]){
        if(cell[m + 1][n - 1]){ intervals = merge(intervals, cell[m + 1][n - 1]); }
        if(cell[m + 1][n    ]){ intervals = merge(intervals, cell[m + 1][n    ]); }
        if(cell[m + 1][n + 1]){ intervals = merge(intervals, cell[m + 1][n + 1]); }
      }
    }
    
    /*if(intervals.length){
      console.log(shop);
      console.log(intervals);
    }*/
    
    for(const interval of intervals){
      const distinfo = segmentPointDistance3D(
        interval[0].X, interval[0].Y, interval[0].Z,
        interval[1].X, interval[1].Y, interval[1].Z,
        XYZ.X, XYZ.Y, XYZ.Z
      );
      const pointdist = distinfo.dist;
      
      if(pointdist < course_deviation_threshold){
        let coursedist = interval[0].dist + norm3D(interval[0].X, interval[0].Y, interval[0].Z, distinfo.x, distinfo.y, distinfo.z); // 最近傍点のコース距離
        let currentdata = {
          "coursedist": coursedist,
          "pointdist": pointdist,
          ...shop
        };
        
        if(shops_tmp.has(shop.id)){
          let existinglist = shops_tmp.get(shop.id);
          if(existinglist[existinglist.length - 1].coursedist + course_between_threshold < coursedist){
            // 既存のリストに追加
            existinglist.push(currentdata);
          }else if(pointdist < existinglist[existinglist.length - 1].pointdist){
            // 直近の最近傍点の更新
            existinglist[existinglist.length - 1] = currentdata;
          }
        }else{
          // 新規作成
          shops_tmp.set(shop.id, [currentdata]);
        }
      }
    }
  }
  
  // 距離順にまとめ直す
  const result = [];
  for(const a of shops_tmp.values()){
    result.push(...a);
  }
  result.sort((a, b) => (a.coursedist - b.coursedist));
  return result;
}

/**
 * 2点間のノルムを与える(3次元)
 */
function norm3D(ax, ay, az, bx, by, bz){
  return Math.sqrt((ax - bx) * (ax - bx) + (ay - by) * (ay - by) + (az - bz) * (az - bz));
}

/**
 * 線分と点の距離、および線分上の最短距離を与える点の座標を返す(3次元)
 */
function segmentPointDistance3D(ax, ay, az, bx, by, bz, px, py, pz){
  const t = (ax * ax + ay * ay + bx * px - ax * (bx + px) + by * py - ay * (by + py) + (az - bz) * (az - pz))/((ax - bx) * (ax - bx) + (ay - by) * (ay - by) + (az - bz) * (az - bz));
  let x;
  let y;
  let z;
  
  if((0 <= t) && (t <= 1)){
    x = ax - (ax - bx) * t;
    y = ay - (ay - by) * t;
    z = az - (az - bz) * t;
  }else if(t > 1){
    x = bx;
    y = by;
    z = bz;
  }else{
    // includes A == B
    x = ax;
    y = ay;
    z = az;
  }
  return {
    "dist": Math.sqrt((x - px) * (x - px) + (y - py) * (y - py) + (z - pz) * (z - pz)),
    "x": x,
    "y": y,
    "z": z
  };
}

/**
 * Hubeny測地線距離計算式
 */
const hubeny = (function(){
  const a = 6378137.0;
  const b = 6356752.314245;
  const f2 = b * b / (a * a);
  const e2 = 1.0 - f2;
  const degree = Math.PI / 180.0;
  const sin = Math.sin;
  const cos = Math.cos;
  const sqrt = Math.sqrt;
  return function (lat1, lon1, lat2, lon2){
    const latdiff = (lat1 - lat2) * degree;
    const londiff = (lon1 - lon2) * degree;
    const latave = 0.5 * (lat1 + lat2) * degree;
    const sinlatave = sin(latave);
    const coslatave = cos(latave);
    const w2 = 1.0 - sinlatave * sinlatave * e2;
    const w = sqrt(w2);
    const meridian = a * f2 / (w2 * w);
    const n = a / w;

    return sqrt(
      latdiff * latdiff * meridian * meridian +
      londiff * londiff * n * n * coslatave * coslatave
    );
  };
})();

/**
 * 緯度経度から地心直交座標系(X, Y, Z)に変換
 */
function latlon2XYZ(lat, lon){
  const a = 6378137.0;
  const b = 6356752.314245;
  const f2 = b * b / (a * a);
  const e2 = 1.0 - f2;
  const degree = Math.PI / 180.0;
  
  const latrad = lat * degree;
  const lonrad = lon * degree;
  
  const sinlat = Math.sin(latrad);
  const coslat = Math.cos(latrad);
  const sinlon = Math.sin(lonrad);
  const coslon = Math.cos(lonrad);
  
  const w2 = 1.0 - sinlat * sinlat * e2;
  const w = Math.sqrt(w2)
  const N = a / w;
  const h = 0.0; // ジオイド高および標高は0[m]とする
  
  return {
    "X": (N + h) * coslat * coslon,
    "Y": (N + h) * coslat * sinlon,
    "Z": N * f2 * sinlat,
  };
}

