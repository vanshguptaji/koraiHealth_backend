import { v2 as cloudinary } from "cloudinary";
import fs from "fs"


cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    secure: true,
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (localFilePath) => {
    try {
        if(!localFilePath) {
            console.log("Please provide a file path");
            return null
        }
        //upload the file on cloudinary
        const response = await cloudinary.uploader.upload(localFilePath, {
            resource_type: "auto",
        });
        //file has been uploaded successfully
        console.log("file is uploaded on cloudinary",
        response.url);
        // fs.unlinkSync(localFilePath) //removing the file that was locally saved as it is now uploaded on cloudinary
        return response;
        
    } catch (error) {
        fs.unlinkSync(localFilePath) //remove the locally saved temporary file as the upload operation got failed
        return null;
    }
}

const deleteOnCloudinary = async (localFilePath) => {
    
}

export { uploadOnCloudinary }

// cloudinary.v2.uploader.upload("https://upload.wikimedia.org/wikipwdia/commons/a/ae/Olympic_flag.jpg",{public_id: "olympic_flag" },
// function(error, result) {console.log(result); });