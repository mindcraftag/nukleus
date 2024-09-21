<template>
  <v-dialog width="400" :value="value" @input="$emit('input', $event)">
    <v-card >
      <v-card-title>Create new field</v-card-title>
      <v-divider></v-divider>
      <v-card-text>

        <v-list dense>
          <v-list-item-group v-model="selectedItem" color="primary">
            <v-list-item v-for="(item, i) in items" :key="i">
              <v-list-item-content>
                <v-list-item-title v-text="item.text"></v-list-item-title>
              </v-list-item-content>
            </v-list-item>
          </v-list-item-group>
        </v-list>

      </v-card-text>
    </v-card>
  </v-dialog>
</template>
<script>

import { tools } from '@mindcraftgmbh/nukleus-vueui'

export default {

  props: {
    value: {
      type: Boolean,
      required: true
    }
  },

  data: () => ({
    items: [
      {
        text: "Separator",
        type: "Separator",
        label: "New separator",
      },
      {
        text: "Link",
        type: "Link",
        displayName: "New link",
        usageAs: ""
      },
      {
        text: "List",
        type: "List",
        name: "NewList",
        displayName: "New list",
        fields: [],
        elementName: "ListElement"
      },
      {
        text: "Tree",
        type: "Tree",
        name: "NewTree",
        displayName: "New tree",
        childTypes: []
      },
      {
        text: "Float",
        type: "Attribute",
        datatype: "Float",
        name: "newFloat",
        displayName: "New float",
        defaultValue: 0
      },
      {
        text: "Integer",
        type: "Attribute",
        datatype: "Integer",
        name: "NewInteger",
        displayName: "New integer",
        defaultValue: 0
      },
      {
        text: "Boolean",
        type: "Attribute",
        datatype: "Boolean",
        name: "NewBoolean",
        displayName: "New boolean",
        defaultValue: false
      },
      {
        text: "BooleanList",
        type: "Attribute",
        datatype: "BooleanList",
        name: "NewBooleanList",
        displayName: "New boolean list"
      },
      {
        text: "Enum",
        type: "Attribute",
        datatype: "Enum",
        name: "NewEnum",
        displayName: "New enum",
        options: [],
        defaultValue: null
      },
      {
        text: "MultiEnum",
        type: "Attribute",
        datatype: "MultiEnum",
        name: "NewMultiEnum",
        displayName: "New multi enum",
        options: []
      },
      {
        text: "Color",
        type: "Attribute",
        datatype: "Color",
        name: "NewColor",
        displayName: "New color",
        defaultValue: {
          r: 255,
          g: 255,
          b: 255,
          a: 255
        }
      },
      {
        text: "NullableColor",
        type: "Attribute",
        datatype: "NullableColor",
        name: "NewNullableColor",
        displayName: "New nullable color",
        defaultValue: {
          r: 255,
          g: 255,
          b: 255,
          a: 255
        }
      },
      {
        text: "Script",
        type: "Attribute",
        datatype: "Script",
        name: "NewScript",
        displayName: "New script",
        defaultValue: ""
      },
      {
        text: "String",
        type: "Attribute",
        datatype: "String",
        name: "NewString",
        displayName: "New string",
        defaultValue: ""
      },
      {
        text: "StringMap",
        type: "Attribute",
        datatype: "StringMap",
        name: "NewStringMap",
        displayName: "New string map"
      },
      {
        text: "Transform",
        type: "Attribute",
        datatype: "Transform",
        name: "NewTransform",
        displayName: "New transform"
      },
      {
        text: "Vector3d",
        type: "Attribute",
        datatype: "Vector3d",
        name: "NewVector3d",
        displayName: "New vector 3d",
        defaultValue: {
          x: 0,
          y: 0,
          z: 0
        }
      },
      {
        text: "Vector4d",
        type: "Attribute",
        datatype: "Vector4d",
        name: "NewVector4d",
        displayName: "New vector 4d",
        defaultValue: {
          x: 0,
          y: 0,
          z: 0,
          w: 0
        }
      }
    ]
  }),

  computed: {
    selectedItem: {
      get() {
        return null;
      },
      set(value) {
        const chosen = tools.clone(this.items[value]);
        delete chosen.text;

        this.$emit('input', false);
        this.$emit('chosen', chosen);
        console.log(chosen);
      }
    }
  },

  created() {
    this.items.sort((a, b) => {
      return a.text.localeCompare(b.text);
    });
  }

}

</script>
