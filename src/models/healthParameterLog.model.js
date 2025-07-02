import mongoose from "mongoose";

const healthParameterLog = new mongoose.Schema({
  userId: {
    type: mongoose.Types.ObjectId,
    ref: "User"
  },
  parameterName: String,
  history: [
    {
      value: Number,
      date: Date
    }
  ]
});

const HealthParameterLog = mongoose.model("HealthParameterLog", healthParameterLog);
export default HealthParameterLog;