import * as mongoose from "mongoose";

interface IItemTemplate {
    name: String;
    type: String;
    client: mongoose.Types.ObjectId;
    rootItem: mongoose.Types.ObjectId;
    folders: mongoose.Types.ObjectId[];
}

interface ItemTemplateDocument extends IItemTemplate, mongoose.Document {}
interface ItemTemplateModel extends mongoose.Model<ItemTemplateDocument> {
    installIndices(): void;
}

export { IItemTemplate, ItemTemplateDocument, ItemTemplateModel };
