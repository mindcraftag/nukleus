<template>

  <v-container fluid grid-list-xl>
    <v-layout row wrap>

      <v-flex d-flex lg2 md6 sm12 xs6 style="padding: 2px;">
        <div class="field-name">
          Label:
        </div>
        <div class="field-value">
          <v-text-field dense v-model="field.displayName" @input="changed" />
        </div>
      </v-flex>
      <v-flex d-flex lg2 md6 sm12 xs6 style="padding: 2px;">
        <div class="field-name">
          Name:
        </div>
        <div class="field-value">
          <v-text-field dense v-model="field.name" @input="changed" />
        </div>
      </v-flex>
      <v-flex d-flex lg8 md12 sm12 xs12 class="type-panel">
        <div style="min-width: 100px; width: 100px; overflow: hidden; padding: 2px">
          <div class="type-specifier">
            {{field.datatype}}
          </div>
        </div>

        <DataTypeEditorFieldAttributeBoolean       v-if="field.datatype==='Boolean'"        v-model="field" />
        <DataTypeEditorFieldAttributeInteger       v-if="field.datatype==='Integer'"        v-model="field" />
        <DataTypeEditorFieldAttributeFloat         v-if="field.datatype==='Float'"          v-model="field" />
        <DataTypeEditorFieldAttributeNullableColor v-if="field.datatype==='NullableColor'"  v-model="field" />
        <DataTypeEditorFieldAttributeColor         v-if="field.datatype==='Color'"          v-model="field" />
        <DataTypeEditorFieldAttributeEnum          v-if="field.datatype==='Enum'"           v-model="field" />
        <DataTypeEditorFieldAttributeTransform     v-if="field.datatype==='Transform'"      v-model="field" />
        <DataTypeEditorFieldAttributeVector3D      v-if="field.datatype==='Vector3d'"       v-model="field" />
        <DataTypeEditorFieldAttributeVector4D      v-if="field.datatype==='Vector4d'"       v-model="field" />
        <DataTypeEditorFieldAttributeBooleanList   v-if="field.datatype==='BooleanList'"    v-model="field" />
        <DataTypeEditorFieldAttributeMultiEnum     v-if="field.datatype==='MultiEnum'"      v-model="field" />
        <DataTypeEditorFieldAttributeString        v-if="field.datatype==='String'"         v-model="field" />
        <DataTypeEditorFieldAttributeStringMap     v-if="field.datatype==='StringMap'"      v-model="field" />
        <DataTypeEditorFieldAttributeScript        v-if="field.datatype==='Script'"         v-model="field" />
      </v-flex>
    </v-layout>
  </v-container>

</template>

<script>

import DataTypeEditorFieldAttributeColor         from './attributes/DataTypeEditorFieldAttributeColor.vue';
import DataTypeEditorFieldAttributeEnum          from './attributes/DataTypeEditorFieldAttributeEnum.vue';
import DataTypeEditorFieldAttributeFloat         from './attributes/DataTypeEditorFieldAttributeFloat.vue';
import DataTypeEditorFieldAttributeBoolean       from './attributes/DataTypeEditorFieldAttributeBoolean.vue';
import DataTypeEditorFieldAttributeNullableColor from './attributes/DataTypeEditorFieldAttributeNullableColor.vue';
import DataTypeEditorFieldAttributeInteger       from './attributes/DataTypeEditorFieldAttributeInteger.vue';
import DataTypeEditorFieldAttributeBooleanList   from './attributes/DataTypeEditorFieldAttributeBooleanList.vue';
import DataTypeEditorFieldAttributeMultiEnum     from './attributes/DataTypeEditorFieldAttributeMultiEnum.vue';
import DataTypeEditorFieldAttributeString        from './attributes/DataTypeEditorFieldAttributeString.vue';
import DataTypeEditorFieldAttributeStringMap     from './attributes/DataTypeEditorFieldAttributeStringMap.vue';
import DataTypeEditorFieldAttributeTransform     from './attributes/DataTypeEditorFieldAttributeTransform.vue';
import DataTypeEditorFieldAttributeVector3D      from './attributes/DataTypeEditorFieldAttributeVector3D.vue';
import DataTypeEditorFieldAttributeVector4D      from './attributes/DataTypeEditorFieldAttributeVector4D.vue';
import DataTypeEditorFieldAttributeScript        from './attributes/DataTypeEditorFieldAttributeScript.vue';

export default {
  name: 'DataTypeEditorFieldAttribute',

  components: {
    DataTypeEditorFieldAttributeColor,
    DataTypeEditorFieldAttributeEnum,
    DataTypeEditorFieldAttributeFloat,
    DataTypeEditorFieldAttributeBoolean,
    DataTypeEditorFieldAttributeNullableColor,
    DataTypeEditorFieldAttributeInteger,
    DataTypeEditorFieldAttributeBooleanList,
    DataTypeEditorFieldAttributeMultiEnum,
    DataTypeEditorFieldAttributeString,
    DataTypeEditorFieldAttributeStringMap,
    DataTypeEditorFieldAttributeTransform,
    DataTypeEditorFieldAttributeVector3D,
    DataTypeEditorFieldAttributeVector4D,
    DataTypeEditorFieldAttributeScript
  },

  props: {
    value: {
      type: Object,
      required: true
    },
  },

  computed: {
    field: {
      get() {
        return this.value;
      },
      set(value) {
        this.$emit('input', value);
      }
    }
  },

  methods: {
    changed() {
      this.$emit('input', this.value);
    }
  }

}
</script>
