import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// @desc    Create a new playlist
// @route   POST /api/v1/playlists
// @access  Private
const createPlaylist = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    if (!name?.trim() || !description?.trim()) {
        throw new ApiError(400, "Name and description are required");
    }

    const playlist = await Playlist.create({
        name: name.trim(),
        description: description.trim(),
        videos: [],
        owner: req.user?._id
    });

    if (!playlist) {
        throw new ApiError(500, "Something went wrong while creating the playlist");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, playlist, "Playlist created successfully"));
});

// @desc    Get user playlists
// @route   GET /api/v1/playlists/user/:userId
// @access  Private/Public
const getUserPlaylists = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    const playlists = await Playlist.find({ owner: userId });

    return res
        .status(200)
        .json(new ApiResponse(200, playlists, "User playlists fetched successfully"));
});

// @desc    Get playlist by ID
// @route   GET /api/v1/playlists/:playlistId
// @access  Private/Public
const getPlaylistById = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    const playlist = await Playlist.findById(playlistId)
        .populate("videos")
        .populate("owner", "username email fullName avatar");

    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Playlist fetched successfully"));
});

// @desc    Add video to playlist
// @route   PATCH /api/v1/playlists/add/:videoId/:playlistId
// @access  Private
const addVideoToPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist or video ID");
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    // Authorization check
    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to add videos to this playlist");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    // Check if video already exists in the playlist
    if (playlist.videos.includes(videoId)) {
        throw new ApiError(400, "Video is already in the playlist");
    }

    playlist.videos.push(videoId);
    await playlist.save();

    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Video added to playlist successfully"));
});

// @desc    Remove video from playlist
// @route   PATCH /api/v1/playlists/remove/:videoId/:playlistId
// @access  Private
const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
    const { playlistId, videoId } = req.params;

    if (!isValidObjectId(playlistId) || !isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid playlist or video ID");
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    // Authorization check
    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to remove videos from this playlist");
    }

    // Check if video is in the playlist
    if (!playlist.videos.includes(videoId)) {
        throw new ApiError(404, "Video not found in the playlist");
    }

    playlist.videos = playlist.videos.filter(
        (id) => id.toString() !== videoId.toString()
    );
    await playlist.save();

    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Video removed from playlist successfully"));
});

// @desc    Delete playlist
// @route   DELETE /api/v1/playlists/:playlistId
// @access  Private
const deletePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    // Authorization check
    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to delete this playlist");
    }

    await Playlist.findByIdAndDelete(playlistId);

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Playlist deleted successfully"));
});

// @desc    Update playlist name and/or description
// @route   PATCH /api/v1/playlists/:playlistId
// @access  Private
const updatePlaylist = asyncHandler(async (req, res) => {
    const { playlistId } = req.params;
    const { name, description } = req.body;

    if (!isValidObjectId(playlistId)) {
        throw new ApiError(400, "Invalid playlist ID");
    }

    if (!name?.trim() && !description?.trim()) {
        throw new ApiError(400, "At least name or description is required to update playlist");
    }

    const playlist = await Playlist.findById(playlistId);
    if (!playlist) {
        throw new ApiError(404, "Playlist not found");
    }

    // Authorization check
    if (playlist.owner.toString() !== req.user?._id.toString()) {
        throw new ApiError(403, "You do not have permission to update this playlist");
    }

    if (name?.trim()) playlist.name = name.trim();
    if (description?.trim()) playlist.description = description.trim();

    await playlist.save();

    return res
        .status(200)
        .json(new ApiResponse(200, playlist, "Playlist updated successfully"));
});

export {
    createPlaylist,
    getUserPlaylists,
    getPlaylistById,
    addVideoToPlaylist,
    removeVideoFromPlaylist,
    deletePlaylist,
    updatePlaylist
};
