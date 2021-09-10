let shoplist = [];
let coursepoints = null;
let courseboundary = null;

window.addEventListener("DOMContentLoaded", function(){
  document.getElementById("gpx_file").addEventListener("change", async function(evt){
    // GPXファイルの読み込み
    try{
      if(evt.target.files.length !== 1){
        throw new Error("no files / too many files are selected");
      }
      const gpx_file = evt.target.files[0];
      document.getElementById("gpx_filename").innerText = gpx_file.name;
      
      console.time("readGPX");
      const gpx = await readGPX(gpx_file);
      console.timeEnd("readGPX");
      
      console.time("createCoursePoints");
      coursepoints = createCoursePoints(gpx);
      console.timeEnd("createCoursePoints");
      console.log("course points: " + coursepoints.length);
      
      console.time("reduceCoursePoints");
      coursepoints = reduceCoursePoints(coursepoints, 1);
      console.timeEnd("reduceCoursePoints");
      console.log("reduced course points: " + coursepoints.length);
      
      console.time("getGPXBoundary");
      courseboundary = getGPXBoundary(coursepoints);
      console.timeEnd("getGPXBoundary");
      
      searchNearbyShops();
      
    }catch(err){
      console.error(err);
      
    }
  });
  
  document.getElementById("course_deviation_threshold").addEventListener("change", function(){
    searchNearbyShops();
  });
  
  document.getElementById("copy_clipboard_result").addEventListener("click", function(evt){
    try{
      if(navigator.clipboard){
        navigator.clipboard.writeText(createShopListTSV());
      }
    }catch(err){
      console.error(err);
    }
    
    evt.preventDefault();
    return false;
  });
  
  document.getElementById("loader").style.display = "none";
});

/**
 * 店舗データ読み込み完了コールバック
 */
function loaddata(data){
  shoplist = shoplist.concat(data);
}

/**
 * ルート沿いのコンビニを探索し、結果を表示
 */
function searchNearbyShops(){
  try{
    if(coursepoints === null){
      throw new Error("no gpx files are selected");
    }
    
    document.getElementById("loader").style.display = "block";
    const course_deviation_threshold = document.getElementById("course_deviation_threshold").value - 0;
    
    console.time("searchNearbyShops");
    
    // 矩形領域で大雑把に絞り込む
    console.time("getShopListInRect");
    const shoplist2 = getShopListInRect(shoplist, courseboundary, course_deviation_threshold);
    console.timeEnd("getShopListInRect");
    console.log("shops in rough rect boundary: " + shoplist2.length);
    
    console.time("getNearbyShops");
    const nearbylist = getNearbyShops(coursepoints, courseboundary, shoplist2, course_deviation_threshold);
    console.timeEnd("getNearbyShops");
    console.log("found shops: " + nearbylist.length);
    //console.log(nearbylist);
    
    console.timeEnd("searchNearbyShops");
    
    outputShopList(nearbylist);
    
    document.getElementById("copy_clipboard_result").disabled = false;
    
  }catch(err){
    console.error(err);
    
  }finally{
    document.getElementById("loader").style.display = "none";
    
  }
}

/**
 * 結果を画面に出力
 */
 function outputShopList(nearbylist){
  const ele = document.getElementById('result');
  const buf = [];
  
  const gmaplink = function(s){
    return '<a href="https://www.google.co.jp/maps?q=' + s.lat.toFixed(6) + ',' + s.lon.toFixed(6) + '" target="_blank" class="googlemap">' + '</a>';
  };
  const infolink = function(s){
    if(s.url){
      return '<a href="' + s.url + '" target="_blank" class="infolink"></a>';
    }else{
      return '';
    }
  };
  
  buf.push('<table class="pure-table pure-table-bordered">');
  buf.push('<thead><tr>');
  buf.push('<th data-copy="true">ルート距離 [km]</th>');
  buf.push('<th data-copy="true">ルートからの距離 [m]</th>');
  buf.push('<th data-copy="true">施設名</th>');
  buf.push('<th data-copy="true">営業時間</th>');
  //buf.push('<th>データソース</th>');
  //buf.push('<th>カテゴリ</th>');
  //buf.push('<th>緯度経度</th>');
  buf.push('<th>情報</th>');
  buf.push('</tr></thead>');
  buf.push('<tbody>');
  
  for(const s of nearbylist.values()){
    buf.push('<tr>'
      + '<td align="right" data-copy="true">' + (s.coursedist * 0.001).toFixed(1) + '</td>'
      + '<td align="right" data-copy="true">' + s.pointdist.toFixed(0) + '</td>'
      + '<td align="left" data-copy="true" title="' + JSON.stringify(s).replace(/"/g, "'") + '">' + s.name + '</td>'
      + '<td align="left" data-copy="true">' + (s.open ? s.open.replace(/\n/g, '<br/>') : '') + '</td>'
    //  + '<td align="left">' + s.source + '</td>'
    //  + '<td align="left">' + s.category + '</td>'
    //  + '<td align="right">' + s.lat.toFixed(6) + ' ' + s.lon.toFixed(6) + '</td>'
      + '<td align="center">' + infolink(s) + ' ' + gmaplink(s) + '</td>'
      + '</tr>'
    );
  }
  
  buf.push('</tbody></table>');
  
  ele.innerHTML = buf.join('\n');
}

/**
 * HTMLテーブルの内容をTSVに変換
 * @return {string}
 */
function createShopListTSV(){
  const buf = [];
  const ele_result = document.getElementById("result");
  
  for(const tr of ele_result.querySelectorAll("tr")){
    const buf2 = [];
    for(const td of tr.querySelectorAll("th,td")){
      if(td.dataset.copy){
        buf2.push("\"" + td.textContent.replace("\"", "\\\"") + "\"");
      }
    }
    if(buf2.length){
      buf.push(buf2.join("\t"));
    }
  }
  
  return buf.join("\n");
}

/**
 * GPXファイルを読み込むPromiseを返す
 * @param {string} file 読み込むファイル
 * @return {XMLDocument} 読み込んだ結果をXMLObjectを返すPromise
 */
function readGPX(file){
  return new Promise(function(resolve, reject){
    try{
      const reader = new FileReader();
      const parser = new DOMParser();

      reader.onload = function(){
        resolve(parser.parseFromString(reader.result, "text/xml"));
      };
      reader.readAsText(file, "utf-8");
      
    }catch(e){
      reject(e);
    }
  });
}

/**
 * GPXデータから計算用のコースデータを作成
 * @param {XMLDocument} gpx
 * @param {number=20000} max_dist_threshold 2地点間を分割しない最大距離
 * @return {[{lat:number,lon:number,dist:number}]}
 */
function createCoursePoints(gpx, max_dist_threshold = 10000){
  const trkpts = gpx.querySelectorAll("trkpt");
  const result = [];
  let coursedist = 0.0;
  let c = 0;
  let plat = trkpts[0].getAttribute("lat") - 0;
  let plon = trkpts[0].getAttribute("lon") - 0;
  let XYZ = latlon2XYZ(plat, plon);

  if(trkpts.length === 0){
    return result;
  }

  // 最初の1点
  result.push({
    "index": 0,
    "lat": plat,
    "lon": plon,
    "dist": coursedist,
    "X": XYZ.X,
    "Y": XYZ.Y,
    "Z": XYZ.Z,
  });

  for(let i = 1; i < trkpts.length; i++){
    const lat = trkpts[i].getAttribute("lat") - 0;
    const lon = trkpts[i].getAttribute("lon") - 0;
    const dist = hubeny(plat, plon, lat, lon);

    // ポイント間距離が空きすぎている場合は分割する
    const N = Math.floor(dist / max_dist_threshold) + 1;
    
    if(N >= 2){
      console.log("divide " + N + ", dist: " + dist);
      const m = divideSegment(plat, plon, lat, lon, N);
      for(let j = 1; j < m.length; j++){
        let XYZ = latlon2XYZ(m[j].lat, m[j].lon);
        coursedist += hubeny(m[j - 1].lat, m[j - 1].lon, m[j].lat, m[j].lon);
        c++;
        result.push({
          "index": c,
          "lat": m[j].lat,
          "lon": m[j].lon,
          "dist": coursedist,
          "X": XYZ.X,
          "Y": XYZ.Y,
          "Z": XYZ.Z,
        });
      }
      coursedist += hubeny(m[m.length - 1].lat, m[m.length - 1].lon, lat, lon);

    }else{
      coursedist += dist;
    }

    let XYZ = latlon2XYZ(lat, lon);
    c++;
    result.push({
      "index": c,
      "lat": lat,
      "lon": lon,
      "dist": coursedist,
      "X": XYZ.X,
      "Y": XYZ.Y,
      "Z": XYZ.Z,
    });

    plat = lat;
    plon = lon;
  }
  
  return result;
}

/**
 * 3次元Douglas-Peuckerでコースの点を間引く
 * @param {[{lat:number,lon:number,X:number,Y:number,Z:number,dist:number}]} coursepoints コースデータ
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
 * @param {[{lat:number,lon:number,X:number,Y:number,Z:number,dist:number}]} coursepoints コースデータ
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
 * @return {[{id:string,lat:number,lon:number,name:string}]} 絞り込み後の店舗リスト
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
 * @param {[{lat:number,lon:number,X:number,Y:number,Z:number,dist:number}]} coursepoints コースデータ
 * @param {{minlat:number,maxlat:number,minlon:number,maxlon:number}} boundary 矩形領域
 * @param {[{id:string,lat:number,lon:number,name:string}]} shoplist 店舗リスト
 * @param {number} course_deviation_threshold コース-施設間の許容距離[m]
 * @param {number=1000} course_between_threshold1 同一の施設を同一の区間として結合して扱うコース距離[m]
 * @param {number=10000} course_between_threshold2 同一の施設を別物として追加するコース距離[m]
 * @return {[{dist:number,lat:number,lon:number,pointdist:number,name:string}]} コース距離順に並べられた近隣店舗リスト
 */
function getNearbyShops(coursepoints, boundary, shoplist, course_deviation_threshold, course_between_threshold1 = 1000, course_between_threshold2 = 10000){
  const result = [];
  
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
    // 出力する区間の候補
    const candidates = [];
    
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
    
    for(const interval of intervals){
      const distinfo = segmentPointDistance3D(
        interval[0].X, interval[0].Y, interval[0].Z,
        interval[1].X, interval[1].Y, interval[1].Z,
        XYZ.X, XYZ.Y, XYZ.Z
      );
      const pointdist = distinfo.dist;
      
      if(pointdist < course_deviation_threshold){
        // 最近傍点のコース距離
        let coursedist = interval[0].dist + Math.sqrt((interval[0].X - distinfo.x) ** 2 + (interval[0].Y - distinfo.y) ** 2 + (interval[0].Z - distinfo.z) ** 2);
        if((candidates.length) && (candidates[candidates.length - 1].end_dist + course_between_threshold1 > coursedist)){
          // 既存の最後の区間からcourse_between_threshold1以内であれば、結合して扱うので、既存の候補区間を更新
          let c = candidates[candidates.length - 1];
          c.end = interval[1].index;
          c.end_dist = interval[1].dist;
          if(c.nearest_point_dist > pointdist){
            c.nearest_point_dist = pointdist;
            c.nearest_course_dist = coursedist;
          }
        }else{
          // 新たな候補区間を作成
          candidates.push({
            "start": interval[0].index,
            "start_dist": interval[0].dist,
            "end": interval[1].index,
            "end_dist": interval[1].dist,
            "nearest_course_dist": coursedist,
            "nearest_point_dist": pointdist
          });
        }
      }
    }
    
    // 候補区間から間隔が短すぎる(course_between_threshold2以内)ものを除外
    if(candidates.length){
      //console.log(candidates);
      result.push({
        "coursedist": candidates[0].nearest_course_dist,
        "pointdist": candidates[0].nearest_point_dist,
        ...shop
      });
      let last_course_dist = candidates[0].nearest_course_dist;
      for(let i = 1; i < candidates.length; i++){
        if(last_course_dist + course_between_threshold2 < candidates[i].nearest_course_dist){
          last_course_dist = candidates[i].nearest_course_dist;
          result.push({
            "coursedist": candidates[i].nearest_course_dist,
            "pointdist": candidates[i].nearest_point_dist,
            ...shop
          });
        }
      }
    }
  }
  
  // 距離順にソートして完了
  result.sort((a, b) => (a.coursedist - b.coursedist));
  return result;
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
 * @param {number} lat1
 * @param {number} lon1
 * @param {number} lat2
 * @param {number} lon2
 * @return {number} distance [m]
 */
const hubeny = (function(){
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);
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
    const meridian = a * (1 - e2) / (w2 * w);
    const n = a / w;

    return sqrt(
      latdiff * latdiff * meridian * meridian +
      londiff * londiff * n * n * coslatave * coslatave
    );
  };
})();

/**
 * 緯度経度から地心直交座標系(X, Y, Z)に変換
 * @param {number} lat1
 * @param {number} lon1
 * @return {{X:number,Y:number,Z:number}}
 */
const latlon2XYZ = (function(){
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);
  const degree = Math.PI / 180.0;
  const sin = Math.sin;
  const cos = Math.cos;
  const sqrt = Math.sqrt;
  
  return function(lat, lon){
    const latrad = lat * degree;
    const lonrad = lon * degree;
    
    const sinlat = sin(latrad);
    const coslat = cos(latrad);
    const sinlon = sin(lonrad);
    const coslon = cos(lonrad);
    
    const w2 = 1.0 - sinlat * sinlat * e2;
    const w = sqrt(w2);
    const N = a / w;
    const h = 0.0; // ジオイド高および標高は0[m]とする
    
    return {
      "X": (N + h) * coslat * coslon,
      "Y": (N + h) * coslat * sinlon,
      "Z": (N * (1 - e2) + h) * sinlat,
    };
  };
})();

/**
 * 地心直交座標系から緯度経度に変換
 * @param {number} X
 * @param {number} Y
 * @param {number} Z
 * @return {{lat:number,lon:number}}
 */
const xyz2LatLon = (function(){
  const a = 6378137.0;
  const f = 1 / 298.257223563;
  const e2 = f * (2 - f);
  const degree = Math.PI / 180.0;
  const sin = Math.sin;
  const cos = Math.cos;
  const sqrt = Math.sqrt;
  const atan = Math.atan;
  const atan2 = Math.atan2;
  const abs = Math.abs;
  
  return function(X, Y, Z){
    const P = sqrt(X * X + Y * Y);
    let lat;
    let lat2;
    let lon;
    
    lat = atan(Z / P);
    for(let i = 0; i < 30; i++){
      lat2 = atan(Z / (P - e2 * (a / sqrt(1 - (sin(lat) ** 2) * e2) * cos(lat))));
      if(abs(lat2 - lat) < 1e-12){
        lat = lat2;
        break;
      }
      lat = lat2;
    }
    
    lon = atan2(Y, X);
    
    return {
      "lat": lat / degree,
      "lon": lon / degree
    };
  };
})();

/**
 * 測地線を分割(地心直交座標系で近似的に分割)したときの中間点の配列を返す
 * @param {number} lat1 
 * @param {number} lon1 
 * @param {number} lat2 
 * @param {number} lon2 
 * @param {number} N 分割数
 * @return {[{lat:number,lon:number}]}
 */
function divideSegment(lat1, lon1, lat2, lon2, N){
  const XYZ1 = latlon2XYZ(lat1, lon1);
  const XYZ2 = latlon2XYZ(lat2, lon2);
  const result = [{
    "lat": lat1,
    "lon": lon1
  }];

  for(let i = 1; i < N; i++){
    const t = i / N;
    const x = XYZ1.X * (1 - t) + XYZ2.X * t;
    const y = XYZ1.Y * (1 - t) + XYZ2.Y * t;
    const z = XYZ1.Z * (1 - t) + XYZ2.Z * t;

    result.push(xyz2LatLon(x, y, z));
  }

  return result;
}