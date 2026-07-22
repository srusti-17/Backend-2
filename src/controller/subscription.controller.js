import mongoose, { isValidObjectId } from "mongoose";
import { Subscription } from "../models/subscription.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Toggle subscription to a channel
// @route   POST /api/v1/subscriptions/c/:channelId
// @access  Private
const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    const channel = await User.findById(channelId);
    if (!channel) {
        throw new ApiError(404, "Channel not found");
    }

    const userId = req.user?._id;

    // Optional: Prevent subscribing to oneself
    if (channelId.toString() === userId.toString()) {
        throw new ApiError(400, "You cannot subscribe to your own channel");
    }

    const existingSubscription = await Subscription.findOne({
        subscriber: userId,
        channel: channelId
    });

    if (existingSubscription) {
        await Subscription.findByIdAndDelete(existingSubscription._id);
        return res
            .status(200)
            .json(new ApiResponse(200, { isSubscribed: false }, "Unsubscribed successfully"));
    } else {
        const newSubscription = await Subscription.create({
            subscriber: userId,
            channel: channelId
        });
        return res
            .status(200)
            .json(new ApiResponse(200, { isSubscribed: true, subscription: newSubscription }, "Subscribed successfully"));
    }
});

// @desc    Get subscribers of a channel
// @route   GET /api/v1/subscriptions/c/:channelId
// @access  Private/Public
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    // Pipeline to match subscriptions for this channel, lookup user details of the subscribers
    const subscribers = await Subscription.aggregate([
        {
            $match: {
                channel: new mongoose.Types.ObjectId(channelId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "subscriber",
                foreignField: "_id",
                as: "subscriber",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$subscriber"
        },
        {
            $project: {
                _id: 1,
                subscriber: 1,
                createdAt: 1
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, subscribers, "Subscribers list fetched successfully"));
});

// @desc    Get channels a specific user has subscribed to
// @route   GET /api/v1/subscriptions/u/:subscriberId
// @access  Private/Public
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const { subscriberId } = req.params;

    if (!isValidObjectId(subscriberId)) {
        throw new ApiError(400, "Invalid subscriber ID");
    }

    // Pipeline to match subscriptions by this subscriber, lookup channel user details
    const channels = await Subscription.aggregate([
        {
            $match: {
                subscriber: new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup: {
                from: "users",
                localField: "channel",
                foreignField: "_id",
                as: "channel",
                pipeline: [
                    {
                        $project: {
                            username: 1,
                            fullName: 1,
                            avatar: 1
                        }
                    }
                ]
            }
        },
        {
            $unwind: "$channel"
        },
        {
            $project: {
                _id: 1,
                channel: 1,
                createdAt: 1
            }
        }
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, channels, "Subscribed channels fetched successfully"));
});

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels
};
