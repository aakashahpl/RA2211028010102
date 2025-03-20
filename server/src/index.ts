import express from "express";
import bodyParser from "body-parser";
import userRoute from "./route/user";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();
const app = express();


const corsOptions = {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  };

app.use(cors(corsOptions));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.json());

app.get("/test",async(req,res)=>{
    res.send("API working");
})
app.use("/",userRoute);

const PORT = process.env.PORT||3000;
app.listen(PORT,()=>{
    console.log(`server is running on Port ${PORT}`);
}) 