import mongoose, { Schema, Document, Types } from 'mongoose';

export interface ICategory extends Document {
    _id: Types.ObjectId;
    name: string;
    parent?: mongoose.Types.ObjectId;
    status: 'active' | 'inactive';
}

const categorySchema: Schema = new Schema({
    name: {
        type: String,
        required: [true, 'Category name is required'],
        trim: true,
        index: true
    },
    parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        index: true
    },
    status: {
        type: String,
        enum: ['active', 'inactive'],
        default: 'active',
        index: true
    }
}, {
    timestamps: true
});

// Create indexes for better performance
categorySchema.index({ name: 1 });
categorySchema.index({ parent: 1 });
categorySchema.index({ status: 1 });

export default mongoose.model<ICategory>('Category', categorySchema);