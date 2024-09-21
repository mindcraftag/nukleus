<template>
  <div v-if="field">
    <Tree
      v-if="field.type === 'Tree'"
      :title="field.displayName"
      :model-value="field.blocks"
      :templates="field.templates"
      :allow-edit="allowEdit"
      :studio-mode="studioMode"
      :item-repo="itemRepo"
      :node-name-resolver="nodeNameResolver"
      :layer-titles="layerTitles"
      :project-folder-id="projectFolderId"
      @changed="$emit('changed')"
    />

    <List
      v-if="field.type === 'List'"
      :title="field.displayName"
      :model-value="field"
      :allow-edit="allowEdit"
      :studio-mode="studioMode"
      :item-repo="itemRepo"
      :node-name-resolver="nodeNameResolver"
      :layer-titles="layerTitles"
      :project-folder-id="projectFolderId"
      @changed="$emit('changed')"
    />

    <LinkField
      v-if="field.type === 'Link'"
      :model-value="field"
      :linkable-types="field.linkableTypes"
      :allow-edit="allowEdit"
      :allow-jump="studioMode"
      :item-repo="itemRepo"
      :project-folder-id="projectFolderId"
      @changed="$emit('changed')"
    />

    <StringField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'String'"
      v-model="value"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <TextAreaField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Text'"
      v-model="value"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <TextFontField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'TextFont'"
      v-model="value"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <StringMapField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'StringMap'"
      v-model="value"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <FloatField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Float'"
      v-model="value"
      :allow-edit="allowEdit"
      :widget="field.widget"
      :min-value="field.minValue"
      :max-value="field.maxValue"
      @changed="changed"
    />

    <IntegerField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Integer'"
      v-model="value"
      :allow-edit="allowEdit"
      :widget="field.widget"
      :min-value="field.minValue"
      :max-value="field.maxValue"
      @changed="changed"
    />

    <ColorField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Color'"
      v-model="value"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <NullableColorField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'NullableColor'"
      v-model="value"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <TransformField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Transform'"
      v-model="value"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <Vector2DField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Vector2d'"
      v-model="value"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <Vector3DField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Vector3d'"
      v-model="value"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <Vector4DField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Vector4d'"
      v-model="value"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <EnumField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Enum'"
      v-model="value"
      :options="field.options"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <MultiEnumField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'MultiEnum'"
      v-model="value"
      :options="field.options"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <BooleanField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Boolean'"
      v-model="value"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <BooleanListField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'BooleanList'"
      v-model="value"
      :allow-edit="allowEdit"
      :length="field.length"
      @changed="changed"
    />

    <LayersField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Layers'"
      v-model="value"
      :allow-edit="allowEdit"
      :layer-titles="layerTitles"
      @changed="changed"
    />

    <TagsField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Tags'"
      v-model="value"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <NodeField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Node'"
      v-model="value"
      :allow-edit="allowEdit"
      :node-name-resolver="nodeNameResolver"
      @changed="changed"
    />

    <StringList
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'StringList'"
      v-model="field"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <LayerMatrix
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'LayerMatrix' && layerTitles"
      v-model="value"
      :allow-edit="allowEdit"
      :layer-titles="layerTitles"
      @changed="changed"
    />

    <AnimationField
      v-if="value !== undefined && field.type === 'Attribute' && field.datatype === 'Animation'"
      v-model="field"
      :allow-edit="allowEdit"
      @changed="changed"
    />

    <NoisePreviewField
      v-if="field.type === 'Attribute' && field.datatype === 'NoisePreview'"
      :item-repo="itemRepo"
      :allow-edit="allowEdit"
      @changed="changed"
    />
  </div>

</template>
<script>

import ColorField from './ColorField.vue'
import NullableColorField from './NullableColorField.vue'
import LinkField from './LinkField.vue'
import FloatField from './FloatField.vue'
import IntegerField from './IntegerField.vue'
import MultiEnumField from './MultiEnumField.vue'
import EnumField from './EnumField.vue'
import TransformField from './TransformField.vue'
import Vector2DField from './Vector2DField.vue'
import Vector3DField from './Vector3DField.vue'
import Vector4DField from './Vector4DField.vue'
import BooleanField from './BooleanField.vue'
import BooleanListField from './BooleanListField.vue'
import StringField from './StringField.vue'
import TextAreaField from './TextAreaField.vue'
import TextFontField from './TextFontField.vue'
import StringMapField from './StringMapField.vue'
import Tree from './Tree.vue'
import List from './List.vue'
import LayersField from './LayersField.vue'
import TagsField from './TagsField.vue'
import NodeField from './NodeField.vue'
import StringList from './StringList.vue'
import LayerMatrix from "./LayerMatrix.vue";
import AnimationField from './AnimationField.vue'
import NoisePreviewField from './NoisePreviewField.vue'
import {watch} from "vue";

export default {

  name: 'Field',

  // --------------------------------------------------------
  // COMPONENTS
  // --------------------------------------------------------
  components: {
    ColorField,
    NullableColorField,
    LinkField,
    FloatField,
    IntegerField,
    EnumField,
    MultiEnumField,
    TransformField,
    Vector2DField,
    Vector3DField,
    Vector4DField,
    BooleanField,
    BooleanListField,
    StringField,
    TextAreaField,
    TextFontField,
    StringMapField,
    Tree,
    List,
    LayersField,
    TagsField,
    NodeField,
    StringList,
    LayerMatrix,
    AnimationField,
    NoisePreviewField
  },

  // ------------------------------------------------------------
  // PROPS
  // ------------------------------------------------------------
  props: {
    modelValue: {
      type: Object,
    },
    allowEdit: {
      type: Boolean,
    },
    studioMode: {
      type: Boolean,
      default: false,
    },
    itemRepo: {
      type: Object,
      required: true,
    },
    nodeNameResolver: {
      type: Function,
      required: true
    },
    layerTitles: {
      type: Array
    },
    projectFolderId: {
      type: String,
      required: true
    }
  },

  // ---------------------------------------------------------
  //  EMITS
  // ---------------------------------------------------------
  emits: ['update:modelValue', 'changed'],

  // ---------------------------------------------------------
  //  DATA
  // ---------------------------------------------------------
  data: () => ({
    value: undefined,
    field: undefined,
    weAreUpdating: false
  }),

  // ---------------------------------------------------------
  //  HOOKS
  // ---------------------------------------------------------
  mounted() {
    watch(() => [this.modelValue], () => {
      this.updateValueAndField();
    });

    this.updateValueAndField();

    this.$store.state.nkclient.eventBus.$on('nk:proxy:valueChange', this.proxyValueChange);
  },

  beforeUnmount() {
    this.$store.state.nkclient.eventBus.$off('nk:proxy:valueChange', this.proxyValueChange);
  },

  // ---------------------------------------------------------
  //  METHODS
  // ---------------------------------------------------------
  methods: {
    updateValueAndField() {
      this.value = this.modelValue.value;
      this.field = this.modelValue;
    },
    forceUpdate() {
      const _this = this;

      // We first clear the field and then set it again in the next tick, thus forcing the UI update
      this.field = null;
      this.$nextTick(function() {
        _this.updateValueAndField();
      });
    },
    changed() {
      // We set the weAreUpdating flag before we do the actual change because it will trigger a valueChange event which we
      // want to ignore in case we triggered it ourselves. We're only interested in value changes caused by anyone
      // else so we can update the UI below
      this.weAreUpdating = true;
      this.field.value = this.value;
      this.$emit('changed');
      this.weAreUpdating = false;
    },
    proxyValueChange(event) {
      if (!this.field || this.weAreUpdating)
        return;

      if (this.field.id === event.fieldId) {
        this.forceUpdate();
      }
    }
  }

}

</script>
