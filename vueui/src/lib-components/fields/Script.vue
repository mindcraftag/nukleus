<template>
  <div class="scriptseparator">
    <div class="scriptseparator-title" @dblclick="collapsed = !collapsed">
      Script
      <div class="float-right">
        <v-icon @click="$emit('remove', script)">mdi-delete</v-icon>
        <v-icon v-if="collapsed" @click="collapsed = !collapsed"
          >mdi-chevron-down</v-icon
        >
        <v-icon v-else @click="collapsed = !collapsed">mdi-chevron-up</v-icon>
      </div>
    </div>
    <v-expand-transition>
      <div v-if="!collapsed" class="scriptseparator-content">
        <LinkField
          v-model="scriptItem"
          :linkable-types="['Script']"
          :allow-edit="allowEdit"
          :allow-jump="studioMode"
          :item-repo="itemRepo"
          :project-folder-id="projectFolderId"
        />

        <div v-if="scriptItem.value">
          <table style="width: 100%">
            <tbody>
              <tr
                v-for="(field, index) in fields"
                :key="field.name"
              >
                <td class="fieldName">
                  {{ field.displayName }}
                </td>
                <td class="fieldValue">
                  <FloatField
                    v-if="
                      field.type === 'Attribute' && field.datatype === 'Float'
                    "
                    v-model="fields[index].value"
                    :allow-edit="allowEdit"
                    :min-value="field.minValue"
                    :max-value="field.maxValue"
                  />

                  <StringField
                    v-if="
                      field.type === 'Attribute' && field.datatype === 'String'
                    "
                    v-model="fields[index].value"
                    :allow-edit="allowEdit"
                  />

                  <BooleanField
                    v-if="
                      field.type === 'Attribute' && field.datatype === 'Boolean'
                    "
                    v-model="fields[index].value"
                    :allow-edit="allowEdit"
                  />

                  <NodeField
                    v-if="
                      field.type === 'Attribute' && field.datatype === 'Node'
                    "
                    v-model="fields[index].value"
                    :allow-edit="allowEdit"
                    :node-name-resolver="nodeNameResolver"
                  />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </v-expand-transition>
  </div>
</template>
<script>
import LinkField from './LinkField.vue'
import FloatField from './FloatField.vue'
import BooleanField from './BooleanField.vue'
import StringField from './StringField.vue'
import NodeField from './NodeField.vue'

export default {

  name: "Script",

  // ---------------------------------------------------------
  //  COMPONENTS
  // ---------------------------------------------------------
  components: {
    FloatField,
    LinkField,
    BooleanField,
    StringField,
    NodeField,
  },

  // ---------------------------------------------------------
  //  PROPS
  // ---------------------------------------------------------
  props: {
    script: {
      type: Object,
      required: true,
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
    projectFolderId: {
      type: String,
      required: true
    }
  },

  // ---------------------------------------------------------
  //  DATA
  // ---------------------------------------------------------
  data: () => ({
    collapsed: false,
  }),

  // ---------------------------------------------------------
  //  COMPUTED
  // ---------------------------------------------------------
  computed: {
    fields: {
      get() {
        return this.script.fields.filter((f) => !!f.type) || []
      },
    },
    scriptItem: {
      get() {
        return this.script.item
      },
      set(value) {
        this.script.item = value
      },
    },
    title: {
      get() {
        return `Script ${this.script.id}`
      },
    },
  },
}
</script>
