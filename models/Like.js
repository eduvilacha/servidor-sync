import mongoose from "mongoose";

const likeSchema = new mongoose.Schema({
  de: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  para: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  match: { type: Boolean, default: false }
});

const Like = mongoose.model("Like", likeSchema);

export default Like;
