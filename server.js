const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");
const WebSocket = require("ws");
const mongoose = require("mongoose");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;


// ===== KẾT NỐI MONGODB =====

mongoose.connect(
"mongodb://Ph_ictu_vn:ictu12345@ac-qf9op2t-shard-00-00.agrd6q1.mongodb.net:27017,ac-qf9op2t-shard-00-01.agrd6q1.mongodb.net:27017,ac-qf9op2t-shard-00-02.agrd6q1.mongodb.net:27017/phdata?ssl=true&replicaSet=atlas-v83gbp-shard-0&authSource=admin&appName=Cluster0"
)
.then(()=>console.log("MongoDB Connected"))
.catch(err=>console.log("MongoDB Error:",err));


// ===== MODEL =====

const PHData = mongoose.model("PHData",{
  ph:Number,
  note:String,
  time:Date
});


// ===== TRẠNG THÁI =====

let currentPH = 7.00;
let lastCommand = "";


// ===== MIDDLEWARE =====

app.use(bodyParser.urlencoded({extended:false}));
app.use(bodyParser.json());
app.use(express.static(__dirname));


// ===== WEBSOCKET =====

wss.on("connection",(ws)=>{

console.log("WebSocket Client Connected");

ws.send(JSON.stringify({
ph:currentPH,
connected:true
}));


ws.on("message",(msg)=>{

try{

const text = msg.toString();

let data;

try{
data = JSON.parse(text);
}catch{
data = { ph: parseFloat(text) };
}

if(data.ph !== undefined){

currentPH = Number(data.ph);

console.log("PH from WebSocket:",currentPH);

broadcastPH();

}

}catch(err){

console.log("WS message error:",err);

}

});


ws.on("close",()=>{

console.log("WebSocket Client Disconnected");

});

});


// ===== HEARTBEAT CHỐNG DISCONNECT =====

setInterval(()=>{

wss.clients.forEach(ws=>{

if(ws.readyState===WebSocket.OPEN){
ws.ping();
}

});

},30000);


// ===== BROADCAST PH =====

function broadcastPH(){

const data = JSON.stringify({
ph:currentPH,
connected:true
});

wss.clients.forEach(client=>{

if(client.readyState===WebSocket.OPEN){

client.send(data);

}

});

}


// ===== ESP GỬI PH (HTTP) =====

app.post("/update",(req,res)=>{

currentPH = req.body.ph;

console.log("Received PH HTTP:",currentPH);

broadcastPH();

res.send("OK");

});


// ===== RECORD DATA =====

app.post("/record",async(req,res)=>{

const note=req.body.note;

console.log("Record PH:",currentPH,"Note:",note);

const data=new PHData({

ph:currentPH,
note:note,
time:new Date()

});

await data.save();

res.send("Recorded");

});


// ===== HISTORY =====

app.get("/history",async(req,res)=>{

const date=req.query.date;

let start=new Date(date);
let end=new Date(date);

end.setHours(23,59,59);

const data=await PHData.find({

time:{
$gte:start,
$lte:end
}

}).sort({time:1});

res.json(data);

});


// ===== COMMAND =====

app.post("/command",(req,res)=>{

lastCommand = req.body.cmd;

console.log("Command from Web:",lastCommand);

// gửi lệnh realtime

wss.clients.forEach(client=>{

if(client.readyState===WebSocket.OPEN){

client.send(JSON.stringify({
cmd:lastCommand
}));

}

});

res.send("OK");

});


// ===== ESP LẤY LỆNH =====

app.get("/get_command",(req,res)=>{

res.json({cmd:lastCommand});

lastCommand="";

});


// ===== START SERVER =====

server.listen(PORT,"0.0.0.0",()=>{

console.log("=================================");
console.log("Server running");
console.log("Local:   http://localhost:"+PORT);
console.log("=================================");

});
