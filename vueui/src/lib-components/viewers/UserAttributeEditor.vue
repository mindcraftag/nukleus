<template>
  <div>
    <ReadOnlyAlert v-if="!allowEdit || readOnly"></ReadOnlyAlert>

    <v-table
      v-if="
        userAttributeTemplates.length > 1 &&
        $store.state.activeClientAttributeTemplatesAllowed
      "
      density="compact"
      :class="cssClasses"
      style="margin-bottom: 20px"
    >
      <tbody>
        <tr>
          <td>Attribute template</td>
          <td class="fieldValue">
            <div class="fieldValueContainer">
              <SmallSelect
                v-model="userAttributeTemplate"
                :items="userAttributeTemplates"
                data-test="attributeTemplateSelect"
              />
            </div>
          </td>
        </tr>
      </tbody>
    </v-table>

    <FieldsEditor
      v-if="item && item.userFieldInstances.length > 0"
      :item="item"
      :allow-edit="allowEdit"
      :item-repo="itemRepo"
      fields-source="userFieldInstances"
      :node-name-resolver="nodeNameResolver"
    />

    <v-table
      v-if="attributesArray.length > 0 || allowEdit"
      density="compact"
      :class="cssClasses"
    >
      <template #default>
        <thead>
          <tr>
            <th class="text-left">Key</th>
            <th class="text-left">Value</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="attr in attributesArray" :key="attr.key">
            <td>{{ attr.key }}</td>
            <td class="fieldValue">
              <div class="fieldValueContainer">
                <SmallTextField
                  v-if="allowEdit && !readOnly"
                  v-model="attr.value"
                  append-icon="mdi-minus"
                  @change="valueChanged(attr.key, attr.value)"
                  @click:append="removeAttribute(attr.key)"
                />
                <SmallTextField
                  v-else
                  v-model="attr.value"
                  :readonly="true"
                />
              </div>
            </td>
          </tr>
          <tr v-if="allowEdit && !readOnly">
            <td>
              <div class="fieldValueContainer">
                <SmallTextField v-model="newKey" />
              </div>
            </td>
            <td class="fieldValue">
              <div class="fieldValueContainer">
                <SmallTextField
                  v-model="newValue"
                  append-icon="mdi-plus"
                  @click:append="addAttribute"
                />
              </div>
            </td>
          </tr>
        </tbody>
      </template>
    </v-table>
  </div>
</template>
<script>

import { watch } from 'vue'
import FieldsEditor from '../fields/FieldsEditor.vue'
import SmallSelect from "../wrappers/SmallSelect.vue";
import SmallTextField from "../wrappers/SmallTextField.vue";
import ReadOnlyAlert from "../helpers/ReadOnlyAlert.vue";

export default {

  name: "UserAttributeEditor",

  components: {
    ReadOnlyAlert,
    SmallTextField,
    SmallSelect,
    FieldsEditor,
  },

  // ------------------------------------------------------------
  // PROPERTIES
  // ------------------------------------------------------------
  props: {
    item: {
      // the edited item
      type: Object,
    },
    allowEdit: {
      type: Boolean,
      default: false,
    },
    itemRepo: {
      type: Object,
      required: true,
    },
    studioMode: {
      type: Boolean,
      default: false,
    },
    nodeNameResolver: {
      type: Function,
      default: null
    }
  },

  // ------------------------------------------------------------
  // DATA
  // ------------------------------------------------------------
  data: () => ({
    newKey: null,
    newValue: null,
    userAttributeTemplates: [],
  }),

  // ------------------------------------------------------------
  // COMPUTED
  // ------------------------------------------------------------
  computed: {
    readOnly() {
      return this.item && this.item.readOnly;
    },
    cssClasses: {
      get() {
        if (this.studioMode) {
          return 'slimForm slimFormStudio'
        } else if (this.$store.state.darkMode) {
          return 'slimForm slimFormDark'
        } else {
          return 'slimForm slimFormLight'
        }
      },
    },
    attributesArray: function () {
      const attr = []

      if (this.item) {
        for (const key in this.item.additionalUserAttributes) {
          attr.push({
            key: key,
            value: this.item.additionalUserAttributes[key],
          })
        }
      }

      return attr
    },
    userAttributeTemplate: {
      get() {
        if (this.item) {
          return this.item.userAttributeTemplate
        }
        return null
      },
      set(value) {
        if (this.item) {
          this.item.userAttributeTemplate = value
          this.itemRepo.setEditedItemDirty()
        }
      },
    },
  },

  // ------------------------------------------------------------
  // CREATED
  // ------------------------------------------------------------
  created() {
    watch(() => [this.item], () => {
      this.loadUserAttributeTemplates()
    });
  },

  // ------------------------------------------------------------
  // MOUNTED
  // ------------------------------------------------------------
  mounted() {
    this.loadUserAttributeTemplates()
  },

  // ------------------------------------------------------------
  // METHODS
  // ------------------------------------------------------------
  methods: {
    async loadUserAttributeTemplates() {
      try {
        if (this.$store.state.activeClientAttributeTemplatesAllowed) {
          const result = await this.$store.state.nkclient.getAttributeTemplates();
          const userAttributeTemplates = result.map((t) => {
            return {
              value: t._id,
              title: t.name
            }
          });

          userAttributeTemplates.sort((a, b) => {
            return a.name.localeCompare(b.name)
          })
          this.userAttributeTemplates = [
            { value: null, title: 'none' },
            ...userAttributeTemplates,
          ]
        } else {
          this.userAttributeTemplates = [{ value: null, title: 'none' }]
        }
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err.toString())
      }
    },

    existsAttributeInFields(name) {
      for (const field of this.item.userFields) {
        if (field.type === 'Attribute' && field.name === name) return true
      }
      return false
    },

    valueChanged(key, value) {
      this.addOrUpdateAttribute(key, value, false)
    },

    setItemDirty() {
      this.itemRepo.setEditedItemDirty()
    },

    existsKey(newKey) {
      for (const key in this.value) {
        if (key === newKey) return true
      }
      return false
    },

    validKey(key) {
      return (
        !key.includes('.') &&
        !key.includes('->') &&
        !key.includes('[') &&
        !key.includes(']')
      )
    },

    validValue(value) {
      return value && value.trim().length > 0
    },

    addAttribute() {
      try {
        this.addOrUpdateAttribute(this.newKey, this.newValue, true)
        this.newKey = null
        this.newValue = null
      } catch (err) {
        console.error(err)
        this.$store.commit('setError', err)
      }
    },

    addOrUpdateAttribute(key, value, isNew) {
      if (!this.validValue(key)) {
        throw 'Key invalid'
      }

      if (!this.validValue(value)) {
        throw 'Value invalid'
      }

      if (isNew) {
        if (!this.validKey(key)) {
          throw 'Key is invalid. Must not contain . or -> or []'
        }

        if (this.existsKey(key)) {
          throw 'Key already exists'
        }

        if (this.existsAttributeInFields(key)) {
          throw 'Key exists in attribute template fields'
        }
      }

      this.item.additionalUserAttributes[key] = value;
      this.setItemDirty()
    },

    removeAttribute(key) {
      delete this.item.additionalUserAttributes[key];
      this.setItemDirty()
    },
  },
}
</script>
