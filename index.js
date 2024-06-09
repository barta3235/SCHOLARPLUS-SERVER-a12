const express= require('express');
const app= express();
const cors= require('cors');
require('dotenv').config();
const PORT= process.env.port || 5000;


//middleware
app.use(cors());
app.use(express.json());


app.get('/',async(req,res)=>{
   res.send('Scholar plus is live')
})

app.listen(PORT,()=>{
    console.log('Scholar plus is live')
})