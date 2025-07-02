// require('dotenv').config({path: './env'})
import dotenv from "dotenv";
import connectDB from "./db/index.js";
import { app } from "./app.js";
import { validateEnv } from './utils/validateEnv.js';

dotenv.config({path: './env'})

validateEnv();

connectDB()
.then(() => {

    app.on("error", (error) =>{
        console.log("error on app side !!!", error);
        process.exit(1);
    })

    app.listen(process.env.PORT || 8000, () => {
        console.log(`Server is running at port ${process.env.PORT}`);
        
    })
})
.catch((error) => {
    console.log("MONGO db connection failed !!! ", error);
})