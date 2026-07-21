import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.service.js";

// @desc    Get all videos based on query, sort, pagination
// @route   GET /api/v1/videos
// @access  Public/Private
const getAllVideos = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
    
    const pipeline = [];

    // Filter by query (title/description)
    if (query) {
        pipeline.push({
            $match: {
                $or: [
                    { title: { $regex: query, $options: "i" } },
                    { description: { $regex: query, $options: "i" } }
                ]
            }
        });
    }

    // Filter by userId
    if (userId) {
        if (!isValidObjectId(userId)) {
            throw new ApiError(400, "Invalid user ID");
        }
        pipeline.push({
            $match: {
                owner: new mongoose.Types.ObjectId(userId)
            }
        });
    }

    // Sort options
    if (sortBy && sortType) {
        pipeline.push({
            $sort: {
                [sortBy]: sortType === "asc" ? 1 : -1
            }
        });
    } else {
        pipeline.push({
            $sort: {
                createdAt: -1
            }
        });
    }

    const options = {
        page: parseInt(page),
        limit: parseInt(limit)
    };

    const aggregate = Video.aggregate(pipeline);
    const videos = await Video.aggregatePaginate(aggregate, options);

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

// @desc    Publish a video (Upload video & thumbnail to Cloudinary, save in DB)
// @route   POST /api/v1/videos
// @access  Private
const publishVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!title?.trim() || !description?.trim()) {
        throw new ApiError(400, "Title and description are required");
    }

    // Check for uploaded files (video & thumbnail)
    const videoFileLocalPath = req.files?.videoFile?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoFileLocalPath) {
        throw new ApiError(400, "Video file is required");
    }
    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail file is required");
    }

    // Upload to Cloudinary
    const videoFile = await uploadOnCloudinary(videoFileLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoFile?.url || !thumbnail?.url) {
        throw new ApiError(400, "Error uploading files to Cloudinary");
    }

    // Create video entry in DB
    const video = await Video.create({
        videoFile: videoFile.url,
        videoFilePublicId: videoFile.public_id,
        thumbnails: thumbnail.url,
        thumbnailPublicId: thumbnail.public_id,
        title: title.trim(),
        description: description.trim(),
        duration: videoFile.duration || 0, // Cloudinary automatically returns duration of video
        owner: req.user?._id,
        isPublished: true
    });

    if (!video) {
        throw new ApiError(500, "Something went wrong while publishing the video");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, video, "Video published successfully"));
});

// @desc    Get video by ID
// @route   GET /api/v1/videos/:videoId
// @access  Public/Private
const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // Find the video and increment views atomically by 1
    const video = await Video.findByIdAndUpdate(
        videoId,
        {
            $inc: { views: 1 }
        },
        { new: true }
    ).populate("owner", "username email fullName avatar");

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video fetched successfully"));
});

// @desc    Update video details (title, description, thumbnail)
// @route   PATCH /api/v1/videos/:videoId
// @access  Private
const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { title, description } = req.body;
    const thumbnailLocalPath = req.file?.path;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    if (!title?.trim() && !description?.trim() && !thumbnailLocalPath) {
        throw new ApiError(400, "At least one field (title, description, or thumbnail) is required to update");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Authorization check
    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to update this video");
    }

    const updateFields = {};

    if (title?.trim()) {
        updateFields.title = title.trim();
    }
    if (description?.trim()) {
        updateFields.description = description.trim();
    }

    if (thumbnailLocalPath) {
        // Upload new thumbnail
        const newThumbnail = await uploadOnCloudinary(thumbnailLocalPath);
        if (!newThumbnail?.url) {
            throw new ApiError(400, "Error while uploading new thumbnail");
        }

        // Store old thumbnail public ID to delete it later
        const oldThumbnailPublicId = video.thumbnailPublicId;

        updateFields.thumbnails = newThumbnail.url;
        updateFields.thumbnailPublicId = newThumbnail.public_id;

        // Delete old thumbnail
        if (oldThumbnailPublicId) {
            await deleteFromCloudinary(oldThumbnailPublicId, "image");
        }
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        { $set: updateFields },
        { new: true }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

// @desc    Delete a video (removes from Cloudinary & DB)
// @route   DELETE /api/v1/videos/:videoId
// @access  Private
const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Authorization check
    if (video.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to delete this video");
    }

    // Delete video file and thumbnail from Cloudinary
    if (video.videoFilePublicId) {
        await deleteFromCloudinary(video.videoFilePublicId, "video");
    }
    if (video.thumbnailPublicId) {
        await deleteFromCloudinary(video.thumbnailPublicId, "image");
    }

    await Video.findByIdAndDelete(videoId);

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Video deleted successfully"));
});

// @desc    Toggle video publish status
// @route   PATCH /api/v1/videos/toggle/publish/:videoId
// @access  Private
const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Authorization check
    if (video.owner?.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to modify this video");
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        {
            $set: {
                isPublished: !video.isPublished
            }
        },
        { new: true }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, `Video publish status toggled to ${updatedVideo.isPublished}`));
});

export {
    getAllVideos,
    publishVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus
};
