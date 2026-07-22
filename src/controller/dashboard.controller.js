import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Get overall stats of a channel (total views, subscribers, videos, likes)
// @route   GET /api/v1/dashboard/stats
// @access  Private
const getChannelStats = asyncHandler(async (req, res) => {
    const channelId = req.user?._id;

    // 1. Total Videos & Total Views
    const videoStats = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $group: {
                _id: null,
                totalViews: { $sum: "$views" },
                totalVideos: { $sum: 1 }
            }
        }
    ]);

    // 2. Total Subscribers
    const totalSubscribers = await Subscription.countDocuments({
        channel: channelId
    });

    // 3. Total Likes
    const likeStats = await Video.aggregate([
        {
            $match: {
                owner: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "video",
                as: "likes"
            }
        },
        {
            $group: {
                _id: null,
                totalLikes: {
                    $sum: { $size: "$likes" }
                }
            }
        }
    ]);

    const stats = {
        totalVideos: videoStats[0]?.totalVideos || 0,
        totalViews: videoStats[0]?.totalViews || 0,
        totalSubscribers: totalSubscribers || 0,
        totalLikes: likeStats[0]?.totalLikes || 0
    };

    return res
        .status(200)
        .json(new ApiResponse(200, stats, "Channel stats retrieved successfully"));
});

// @desc    Retrieve all uploaded videos of the logged-in channel
// @route   GET /api/v1/dashboard/videos
// @access  Private
const getChannelVideos = asyncHandler(async (req, res) => {
    const channelId = req.user?._id;

    const videos = await Video.find({ owner: channelId }).sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Channel videos retrieved successfully"));
});

export {
    getChannelStats,
    getChannelVideos
};
