// カメラ付き検査用

//import { stringify } from "";
import { RelayServer } from "https://chirimen.org/remote-connection/js/beta/RelayServer.js";
let canvas;
let contextCanvas;
var channel;
var channel_csv;
var id_this_device = 100;
let mediaRecorder;
class dataForSend {
  constructor(
    id,
    data_a0,
    data_a1,
    data_a2,
    data_a3,
    data_a4,
    data_a5,
    data_a6,
    data_a7,
    timestamp
  ) {
    this.info = "SensorData";
    this.my_id = id; // ラズパイのID
    this.data_a0 = data_a0; // ポートa0でのデータ
    this.data_a1 = data_a1; // ポートa1でのデータ
    this.data_a2 = data_a2; // ポートa2でのデータ
    this.data_a3 = data_a3; // ポートa3でのデータ
    this.data_a4 = data_a4; // ポートa0でのデータ
    this.data_a5 = data_a5; // ポートa1でのデータ
    this.data_a6 = data_a6; // ポートa2でのデータ
    this.data_a7 = data_a7; // ポートa3でのデータ
    this.timestamp = timestamp; // ミリ秒単位
  }
}
class dataForSendCSV {
  constructor(id, data_ras0, data_ras1) {
    this.info = "CSVData";
    this.my_id = id; // ラズパイのID
    this.data_ras0 = data_ras0; // ラズパイras0でのデータ
    this.data_ras1 = data_ras1; // ラズパイras1でのデータ
  }
}

// window.getRandom = getRandom;
//windowWidth = window.innerWidth;

var millisecond_for_data = 30; // ラズパイが設定している次の計測までの待機時間
var minute_for_save = 5; // データを一時保存する期間(分)
// var length_max_data = (minute_for_save * 60 * 1000 * 2) / millisecond_for_data; // データを残す最大のlistの長さ．2は接続するラズパイの数
var length_max_data = (10 * 1000 * 2) / millisecond_for_data;
var data = new dataForSend(-1, 1, 1, 1, 1, 10000);
var mdata = new dataForSend(-1, 4095, 4095, 4095, 4095, 10000);
var start_button_pushed = false;
var date_pre = new Date();

//var temp = 4095;
var num_data_draw = (10 * 1000) / (millisecond_for_data * 2);
var array_data_ras0 = [];
var array_data_ras1 = [];
var array_label_ras0 = [];
var array_label_ras1 = [];
var flag_remote_start = false;

let JSON_calib = [];

onload = async function () {
  // webSocketリレーの初期化
  var relay = RelayServer("chirimentest", "chirimenSocket");
  channel = await relay.subscribe("gram_iot");
  channel_csv = await relay.subscribe("gram_csv");
  message_div.innerText = "web socketリレーサービスに接続しました";
  notification_test_div.innerText = "testtest";
  array_data_ras0.push(new dataForSend(0, 0, 0, 0, 0, 0));
  array_data_ras1.push(new dataForSend(1, 0, 0, 0, 0, 0));
  // array_labelはいらない子になったかも
  array_label_ras0.push(new Date(0));
  array_label_ras1.push(new Date(0));
  channel.onmessage = getMessage;
  channel_csv.onmessage = getMessageCSV;

  window.resetData = resetData();
  //window.outputCSV = outputCSV();
  window.outputJSON = outputJSON; // 括弧は不要

  // -vvv--video--vvv-
  var video = document.getElementById("myVideo");
  var videoIds = [];
  if (!navigator.mediaDevices?.enumerateDevices) {
    console.log("enumerateDevices() not supported.");
  } else {
    // List cameras and microphones.
    navigator.mediaDevices
      .enumerateDevices()
      .then(function (devices) {
        var dddo = [];
        devices.forEach((device) => {
          // console.log(
          //   `${device.kind}: ${device.label} id = ${device.deviceId}`
          // );
          dddo.push(`${device.kind}: ${device.label} id = ${device.deviceId}`);
          if (device.kind == "videoinput") {
            videoIds.push(device.deviceId);
          }
          return videoIds;
        });
        //notification_test_div.innerText = dddo;
        //notification_test_div.innerText = videoIds;
        var constrains = {
          audio: true,
          video: { deviceId: videoIds[2], facingMode: "environment" }, // どのカメラを使うかはここのidの選択を変える
        };
        navigator.mediaDevices
          .getUserMedia(constrains)
          .then(function (stream) {
            video.srcObject = stream;
            video.muted = true;
            video.play();
            mediaRecorder = new MediaRecorder(stream);
            mediaRecorder.addEventListener("dataavailable", (e) => {
              const objectUrl = URL.createObjectURL(e.data);
              const downloadLink = document.createElement("a");
              const fileName = "output_camera.mp4";
              downloadLink.download = fileName;
              downloadLink.href = objectUrl;
              downloadLink.click();
              downloadLink.remove();
            });

            // -vvv--start or stop button--vvv-
            // start button
            document
              .getElementById("button_start")
              .addEventListener("click", function () {
                pushedStart();
                document.getElementById("button_start").disabled = true;
                document.getElementById("button_stop").disabled = false;
              });
            // stop button
            document
              .getElementById("button_stop")
              .addEventListener("click", function () {
                pushedStop();
                document.getElementById("button_start").disabled = false;
                document.getElementById("button_stop").disabled = true;
              });
            // -^^^--start or stop button--^^^-
          })
          .catch(function (err) {
            console.log("An error occured! " + err);
          });
      })
      .catch((err) => {
        console.error(`${err.name}: ${err.message}`);
      });
  }
  // -^^^--video--^^^-
};

function getMessageCSV(msg) {
  mdata = msg.data;
  console.log("getmessa: ", mdata);

  if (mdata == "start") {
    flag_remote_start = true;
    pushedStart();
  } else if (mdata == "stop") {
    pushedStop();
    flag_remote_start = false;
  }

  // pushedStart()
}

function getMessage(msg) {
  // メッセージを受信したときに起動する関数
  mdata = msg.data;
  // 各ポートの値を取得
  if (mdata.my_id != id_this_device) {
    if (mdata.my_id == 0) {
      array_data_ras0 = array_data_ras0.concat(
        new dataForSend(
          mdata.my_id,
          // ADC1つ目
          mdata.data_a0,
          mdata.data_a1,
          mdata.data_a2,
          mdata.data_a3,
          // ADC2つ目
          mdata.data_a4,
          mdata.data_a5,
          mdata.data_a6,
          mdata.data_a7,
          // タイムスタンプ
          mdata.timestamp
        )
      ); // arrayで送られたデータを結合する
      // 同じラベルが挿入されるのを防ぎたい
      array_label_ras0 = array_label_ras0.concat(mdata.timestamp);
    } else if (mdata.my_id == 1) {
      // id==1の時

      array_data_ras1 = array_data_ras1.concat(
        new dataForSend(
          mdata.my_id,
          // ADC1つ目
          mdata.data_a0,
          mdata.data_a1,
          mdata.data_a2,
          mdata.data_a3,
          // ADC2つ目
          mdata.data_a4,
          mdata.data_a5,
          mdata.data_a6,
          mdata.data_a7,
          // タイムスタンプ
          mdata.timestamp
        )
      ); // arrayで送られたデータを結合する
      array_label_ras1 = array_label_ras1.concat(mdata.timestamp);

      //array_label.push(new Date(mdata.timestamp));
      //array_label.push(mdata.timestamp);
    }
    // console.log(
    //   "array_ras0: ",
    //   array_data_ras0,
    //   "; array_ras1: ",
    //   array_data_ras1
    // );
    // console.log("mdata: ", mdata);
  }

  // 表示用
  // console.log(
  //   "type:",
  //   typeof array_data_ras0[array_data_ras0.length - 1].data_a0
  // );
  message_id.innerText = mdata.my_id;
  if (array_data_ras0.length > 0) {
    // 配列の2番目を指定しているのは
    // 現在のラズパイのサンプリングが一度に2つ送ってるからっぽい
    message_div.innerText = plusArray(
      array_data_ras0[array_data_ras0.length - 1].data_a0,
      array_data_ras0[array_data_ras0.length - 1].data_a1,
      array_data_ras0[array_data_ras0.length - 1].data_a2,
      array_data_ras0[array_data_ras0.length - 1].data_a3,
      array_data_ras0[array_data_ras0.length - 1].data_a4,
      array_data_ras0[array_data_ras0.length - 1].data_a5,
      array_data_ras0[array_data_ras0.length - 1].data_a6,
      array_data_ras0[array_data_ras0.length - 1].data_a7
    )[0];
  }
  if (array_data_ras1.length > 0) {
    message_div2.innerText = plusArray(
      array_data_ras1[array_data_ras1.length - 1].data_a0,
      array_data_ras1[array_data_ras1.length - 1].data_a1,
      array_data_ras1[array_data_ras1.length - 1].data_a2,
      array_data_ras1[array_data_ras1.length - 1].data_a3,
      array_data_ras1[array_data_ras1.length - 1].data_a4,
      array_data_ras1[array_data_ras1.length - 1].data_a5,
      array_data_ras1[array_data_ras1.length - 1].data_a6,
      array_data_ras1[array_data_ras1.length - 1].data_a7
    )[0];
  }
  temp_div.innerText = array_label_ras0[array_label_ras0.length - 1];
  temp_div2.innerText = array_label_ras1[array_label_ras1.length - 1];

  // ここに送信用データを更新するプログラム

  //channel.send(data);
  // console.log("data ras0:", array_data_ras0[array_data_ras0.length - 1]);
  // console.log("data ras1:", array_data_ras1[array_data_ras1.length - 1]);

  // 一定時間で更新
  var date_now = new Date();
  if (date_now.getTime() - date_pre.getTime() >= 1000) {
    updateGraph();
    date_pre = date_now;
  }
  //updateGraph();
}
// ボタンをクリックしたら、グラフを再描画
function testGraph() {
  // すでにグラフ（インスタンス）が生成されている場合は、グラフを破棄する
  if (typeof myLineChart !== "undefined" && myLineChart) {
    window.myLineChart.destroy();
  }

  drawChart(); // グラフを再描画
}

function updateGraph() {
  if (typeof myLineChart !== "undefined" && myLineChart) {
    window.myLineChart.destroy();
  }

  drawChart(); // グラフを再描画
}

function drawChart() {
  // データの長さを調整する(何回かおきに実行でもいいかも)
  if (!start_button_pushed) {
    array_data_ras0 = sliceData(array_data_ras0, length_max_data);
    array_data_ras1 = sliceData(array_data_ras1, length_max_data);
    array_label_ras0 = sliceData(array_label_ras0, length_max_data);
    array_label_ras1 = sliceData(array_label_ras1, length_max_data);
  }

  // console.log(
  //   "len ras0:",
  //   array_data_ras0.length,
  //   "len ras1:",
  //   array_data_ras1.length
  // );
  var datasets = makeDatasetForGraph(
    array_data_ras0,
    array_data_ras1,
    array_label_ras0,
    array_label_ras1
  );
  // console.log("datasets:", datasets);

  var ctx = document.getElementById("canvas").getContext("2d");
  ctx.canvas.height = "100%";
  window.myLineChart = new Chart(ctx, {
    type: "line",
    data: {
      // ラベルとデータセット
      labels: datasets[2],
      datasets: [
        {
          // ポートa0を表すグラフ
          type: "line",
          label: "Raspberry ID: 0",
          data: datasets[0], // グラフデータ
          tension: 0, // グラフを直線で描画する
          backgroundColor: "rgba(0, 134, 197, 0.7)", // 棒の塗りつぶし色
          borderColor: "rgba(0, 134, 197, 1)", // 棒の枠線の色
          borderWidth: 1, // 枠線の太さ
          fill: false, // 塗りつぶさない
        },
        {
          // ポートa1を表すグラフ
          type: "line",
          label: "Raspberry ID: 1",
          data: datasets[1], // グラフデータ
          tension: 0, // グラフを直線で描画する
          backgroundColor: "rgba(210, 0, 197, 0.7)", // 棒の塗りつぶし色
          borderColor: "rgba(210, 0, 197, 1)", // 棒の枠線の色
          borderWidth: 1, // 枠線の太さ
          fill: false, // 塗りつぶさない
        },
      ],
    },
    options: {
      legend: {
        display: true, // 凡例を非表示
        labels: {
          // filter(legendItem) {
          //   // legendItem.datasetIndex には関連したデータセットの index が入ってます
          //   // true で表示 false で非表示
          //   return legendItem.datasetIndex === 0;
          // },
        },
      },
      animation: false,
      scales: {
        xAxes: [
          {
            ticks: {
              autoSkip: true,
              maxTicksLimit: 15,

              maxRotation: 90,
              minRotation: 90,
            },
          },
        ],
        yAxes: [
          {
            ticks: {
              beginAtZero: true,
              suggestedMax: 200,
            },
          },
        ],
      },
    },
    plugins: {
      legend: {
        labels: {
          // filter: function (item, chart) {
          //   return !item.text.includes("unused");
          // },
        },
      },
    },
  });
}

// グラフデータの値をランダムに生成
var chartVal = []; // グラフデータ（描画するデータ）

function getRandom() {
  chartVal = []; // グラフデータを初期化
  var length = 12;
  for (i = 0; i < length; i++) {
    chartVal.push(Math.floor(Math.random() * 20));
  }
}

function isArray(obj) {
  return Object.prototype.toString.call(obj) === "[object Array]";
}

// 複数の1次元配列の各要素で加算を行う
function plusArray(a0, a1, a2, a3, a4, a5, a6, a7) {
  if (
    !isArray(a0) &&
    !isArray(a1) &&
    !isArray(a2) &&
    !isArray(a3) &&
    !isArray(a4) &&
    !isArray(a5) &&
    !isArray(a6) &&
    !isArray(a7)
  ) {
    console.log("invalid data(not Array))!", a0, a1, a2, a3, a4, a5, a6, a7);
    return [];
  }
  var out_array = [];

  for (var i = 0; i < a0.length; i++) {
    var tmp_sum = a0[i] + a1[i] + a2[i] + a3[i] + a4[i] + a5[i]; //+ a6[i] + a7[i];
    out_array.push(tmp_sum);
  }

  return out_array;
}

// 配列内の平均を計算する
function avgInArray(array_include_num) {
  // 引数処理
  if (!isArray(array_include_num)) {
    console.log("invalid data(not Array))!", array_include_num);
    return 0;
  } else if (typeof array_include_num === "number") {
    return array_include_num;
  }

  var num_sum = 0;
  num_sum = array_include_num.reduce(function (sum, element) {
    return sum + element;
  }, 0);
  var out_avg = num_sum / array_include_num.length;

  return out_avg;
}

function pickupdata(array_in_rasdata, mode = "SUM") {
  // 不正なデータに対する処理
  if (
    !isArray(array_in_rasdata) ||
    array_in_rasdata.length == 0 ||
    !(array_in_rasdata[0] instanceof dataForSend)
  ) {
    // console.log(
    //   "function pickupdata was recieved invalid data!",
    //   array_in_rasdata
    // );
    return [];
  }
  // 指定されたモードによってrasdata内のデータの取り出し方を変更する
  switch (mode) {
    // すべてのポートのデータを加算した配列を出力する
    case "SUM":
      var array_out = [];
      for (var rasdata of array_in_rasdata) {
        var array_sum = [];
        array_sum = plusArray(
          rasdata.data_a0,
          rasdata.data_a1,
          rasdata.data_a2,
          rasdata.data_a3,
          rasdata.data_a4,
          rasdata.data_a5,
          rasdata.data_a6,
          rasdata.data_a7
        );
        array_out = array_out.concat(array_sum);
      }
      return array_out;
      break;
    default:
      console.log(
        "function pickupdata was recieved invalid mode-option!: ",
        mode
      );
      return null;
  }
}

function makeDatasetForGraph(
  array_in_data_ras0,
  array_in_data_ras1,
  array_in_timestamp_ras0,
  array_in_timestamp_ras1
) {
  var tmp_data_ras0 = [];
  var tmp_data_ras1 = [];
  var tmp_time = [];

  // 配列の長さによって処理を変える
  if (array_in_data_ras0.length < num_data_draw) {
    if (array_in_timestamp_ras0.length > 0) {
      tmp_data_ras0 = pickupdata(array_in_data_ras0).concat();
      tmp_data_ras1 = pickupdata(array_in_data_ras1).concat();
      tmp_time = array_in_timestamp_ras0.concat();
    } else {
      tmp_data_ras0 = pickupdata(array_in_data_ras0).concat();
      tmp_data_ras1 = pickupdata(array_in_data_ras1).concat();
      tmp_time = array_in_timestamp_ras1.concat();
    }

    // データの長さをnum_data_drawにするために先頭を0で埋める
    for (
      ;
      tmp_data_ras0.length < num_data_draw &&
      tmp_data_ras1.length < num_data_draw;

    ) {
      tmp_data_ras0.unshift(0);
      tmp_data_ras1.unshift(0);
      tmp_time.unshift(0);
    }
  } else {
    // 最新の記録numDataDraw個取り出す
    tmp_data_ras0 = pickupdata(array_in_data_ras0).slice(-1 * num_data_draw);
    tmp_data_ras1 = pickupdata(array_in_data_ras1).slice(-1 * num_data_draw);
    tmp_time = array_in_timestamp_ras0.slice(-1 * num_data_draw);
    //console.log(pickupdata(array_in_data_ras0));
  }

  return [tmp_data_ras0, tmp_data_ras1, tmp_time];
}

// スタートボタンが押されたときに実行する関数
function pushedStart() {
  // 録画開始
  resetData();
  if (!flag_remote_start) {
    mediaRecorder.start();
  }
  start_button_pushed = true;
}

// ストップボタンが押されたときに実行する関数
function pushedStop() {
  // 録画停止
  outputCSV();
  if (!flag_remote_start) {
    mediaRecorder.stop();
  }
  // グラフの保存
  // var downloadLink = document.getElementById("download_link");
  // var canvas = document.getElementById("canvas");
  // downloadLink.href = canvas.toDataURL("image/png");
  // downloadLink.download = "graph.png";
  // downloadLink.click();

  resetData(); // データとグラフをリセットする
  start_button_pushed = false;
}

// 蓄積したデータを初期化する関数
function resetData() {
  array_data_ras0 = [];
  array_data_ras1 = [];
  array_label_ras0 = [];
  array_label_ras1 = [];
  // array_data_a0.push(0);
  // array_data_a1.push(0);
  // array_label.push(0);
  // array_label_a1.push(0);

  // -vvv--test test test--vvv-
  // array_data_a0.push(100);
  // array_data_a1.push(500);
  // //array_label.push(new Date(40619));
  // array_label.push(40619);
  // array_data_a0.push(100);
  // array_data_a1.push(500);
  // array_label.push(40619);
  // array_data_a0.push(500);
  // array_data_a1.push(600);
  // array_label.push(9000635);
  // -^^^--test test test--^^^-

  updateGraph();
}

// 蓄積したデータをスライスする関数
function sliceData(list_data, out_length) {
  if (list_data.length <= out_length) {
    return list_data;
  }
  var out_data = list_data;

  out_data = out_data.slice(-1 * out_length);
  return out_data;
}

// 研究用モニタークライアントに収集データを送信する関数
// スタートを押さないとこの関数の実行ができないようにする必要がある．
function outputCSV() {
  var iot1 = [];
  var iot2 = [];
  var timestamp1 = [];
  var timestamp2 = [];
  var outdata = [];

  // キャリブレーション用
  let tmp_for_csv = [];

  const data_for_csv_client = new dataForSendCSV(
    id_this_device,
    array_data_ras0,
    array_data_ras1
  );

  console.log("testest;", array_data_ras0);

  for (var i = 0; i < array_data_ras0.length; i++) {
    for (var j = 0; j < array_data_ras0[i].data_a0.length; j++) {
      var fgh = array_data_ras0[i];
      var sum_fgh =
        fgh.data_a0[j] +
        fgh.data_a1[j] +
        fgh.data_a2[j] +
        fgh.data_a3[j] +
        fgh.data_a4[j] +
        fgh.data_a5[j] +
        fgh.data_a6[j] +
        fgh.data_a7[j];
      iot1.push(sum_fgh);
      timestamp1.push(fgh.timestamp[j]);

      // キャリブレーション用
      tmp_for_csv.push({
        // 地獄
        id: String(fgh.my_id),
        a0: String(fgh.data_a0[j]),
        a1: String(fgh.data_a1[j]),
        a2: String(fgh.data_a2[j]),
        a3: String(fgh.data_a3[j]),
        a4: String(fgh.data_a4[j]),
        a5: String(fgh.data_a5[j]),
        a6: String(fgh.data_a6[j]),
        a7: String(fgh.data_a7[j]),
        timestamp: String(fgh.timestamp[j]),
      });
    }
  }
  for (var i = 0; i < array_data_ras1.length; i++) {
    for (var j = 0; j < array_data_ras1[i].data_a0.length; j++) {
      var fgh = array_data_ras1[i];
      var sum_fgh =
        fgh.data_a0[j] +
        fgh.data_a1[j] +
        fgh.data_a2[j] +
        fgh.data_a3[j] +
        fgh.data_a4[j] +
        fgh.data_a5[j] +
        fgh.data_a6[j] +
        fgh.data_a7[j];
      iot2.push(sum_fgh);
      timestamp2.push(fgh.timestamp[j]);

      // キャリブレーション用
      tmp_for_csv.push({
        // 地獄
        id: String(fgh.my_id),
        a0: String(fgh.data_a0[j]),
        a1: String(fgh.data_a1[j]),
        a2: String(fgh.data_a2[j]),
        a3: String(fgh.data_a3[j]),
        a4: String(fgh.data_a4[j]),
        a5: String(fgh.data_a5[j]),
        a6: String(fgh.data_a6[j]),
        a7: String(fgh.data_a7[j]),
        timestamp: String(fgh.timestamp[j]),
      });
    }
  }
  outdata.push();

  var out_JSON = JSON.stringify({
    iot1: iot1,
    iot2: iot2,
    timestamp1: timestamp1,
    timestamp2: timestamp2,
  });

  let out_Calib = JSON.stringify(tmp_for_csv);
  JSON_calib = out_Calib;
  console.log("JSON:", out_JSON);
  console.log("For Calib:", out_Calib);

  channel.send(data_for_csv_client);
  channel_csv.send(out_JSON);
  // console.log("The csv data was sended!");
  // console.log(data_for_csv_client);

  // JSON用のボタンを活性化する
  document.getElementById("button_json").disabled = false;
}

// キャリブレーション用にJSONファイルをダウンロードするための関数
function outputJSON() {
  //console.log("button JSON was pushed!!");

  // キャリブレーション用のJSONファイルをダウンロード
  const blob_calib = new Blob([JSON_calib], { type: "application/json" });
  const url_calib = URL.createObjectURL(blob_calib);
  const a_calib = document.createElement("a");
  a_calib.href = url_calib;
  a_calib.download = "calib_.json";
  a_calib.click();
  a_calib.remove();
  window.URL.revokeObjectURL(url_calib);

  // JSONファイルをダウンロードしたらボタンを非活性化する
  document.getElementById("button_json").disabled = true;
}
