import { Request, Response } from 'express';
import Note from '../models/Note.js';

export const createNote = async (req: Request, res: Response) => {
  try {
    const { projectId, paperId, title, content, tags } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const note = new Note({
      projectId,
      paperId,
      title: title || 'Untitled Note',
      content: content || '',
      tags: tags || [],
    });

    await note.save();
    return res.status(201).json(note);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getNotes = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.query;
    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }
    const notes = await Note.find({ projectId }).sort({ updatedAt: -1 });
    return res.status(200).json(notes);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const getNoteById = async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const note = await Note.findById(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    return res.status(200).json(note);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const updateNote = async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { title, content, tags, paperId } = req.body;

    const note = await Note.findByIdAndUpdate(
      noteId,
      { title, content, tags, paperId },
      { new: true }
    );

    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }

    return res.status(200).json(note);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteNote = async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const note = await Note.findByIdAndDelete(noteId);
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    return res.status(200).json({ message: 'Note deleted successfully' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
};
