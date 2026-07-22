import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { Video } from "../models/video.model.js";
import { Tweet } from "../models/tweet.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Toggle like on a video
// @route   POST /api/v1/likes/toggle/v/:videoId
// @access  Private
const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    const userId = req.user?._id;

    // Check if the user already liked the video
    const existingLike = await Like.findOne({
        video: videoId,
        likedBy: userId
    });

    if (existingLike) {
        // If already liked, unlike it (delete document)
        await Like.findByIdAndDelete(existingLike._id);
        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: false }, "Video unliked successfully"));
    } else {
        // If not liked, like it (create document)
        const newLike = await Like.create({
            video: videoId,
            likedBy: userId
        });
        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: true, like: newLike }, "Video liked successfully"));
    }
});

// @desc    Toggle like on a tweet
// @route   POST /api/v1/likes/toggle/t/:tweetId
// @access  Private
const toggleTweetLike = asyncHandler(async (req, res) => {
    const { tweetId } = req.params;

    if (!isValidObjectId(tweetId)) {
        throw new ApiError(400, "Invalid tweet ID");
    }

    const tweet = await Tweet.findById(tweetId);
    if (!tweet) {
        throw new ApiError(404, "Tweet not found");
    }

    const userId = req.user?._id;

    // Check if the user already liked the tweet
    const existingLike = await Like.findOne({
        tweet: tweetId,
        likedBy: userId
    });

    if (existingLike) {
        // If already liked, unlike it
        await Like.findByIdAndDelete(existingLike._id);
        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: false }, "Tweet unliked successfully"));
    } else {
        // If not liked, like it
        const newLike = await Like.create({
            tweet: tweetId,
            likedBy: userId
        });
        return res
            .status(200)
            .json(new ApiResponse(200, { isLiked: true, like: newLike }, "Tweet liked successfully"));
    }
});

export {
    toggleVideoLike,
    toggleTweetLike
};
