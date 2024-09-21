<template>
  <Dialog v-model="show" title="Create purchasable" width="700px">
    <template #default>
      <SlimFormCard>
        <template #default>
          <table style="width: 100%">
            <tr>
              <td class="fieldName">Name</td>
              <td class="fieldValue">
                <div class="fieldValueContainer">
                  <SmallTextField
                      v-model="name"
                      data-test="nameTextField"
                      required
                  ></SmallTextField>
                </div>
              </td>
            </tr>
            <tr>
              <td class="fieldName">Description</td>
              <td class="fieldValue">
                <div class="fieldValueContainerFlexHeight">
                  <SmallTextArea
                      v-model="description"
                      data-test="descriptionTextArea"
                      required
                      no-resize
                      hide-details
                  ></SmallTextArea>
                </div>
              </td>
            </tr>
            <tr>
              <td class="fieldName">Group ID (Optional)</td>
              <td class="fieldValue">
                <div class="fieldValueContainer">
                  <SmallTextField
                      v-model="groupId"
                      data-test="nameTextField"
                      required
                  ></SmallTextField>
                </div>
              </td>
            </tr>
            <tr>
              <td class="fieldName">Publically visible</td>
              <td class="fieldValue">
                <div class="fieldValueContainer">
                  <SmallCheckbox
                      v-model="isPublic"
                  ></SmallCheckbox>
                </div>
              </td>
            </tr>
            <tr>
              <td class="fieldName">Prices contain VAT</td>
              <td class="fieldValue">
                <div class="fieldValueContainer">
                  <SmallCheckbox
                      v-model="pricesContainVat"
                  ></SmallCheckbox>
                </div>
              </td>
            </tr>
            <tr>
              <td class="fieldName">Options</td>
              <td class="fieldValue">
                <div style="overflow: auto; max-height: 400px">
                  <PurchasableOption
                      v-for="option of options"
                      :key="option._id"
                      :option="option"
                      @remove="removeOption"
                  ></PurchasableOption>
                </div>
                <v-btn @click="addOption">Add option</v-btn>
              </td>
            </tr>
            <tr>
              <td></td>
              <td class="fieldName" style="padding-top: 10px; font-style: italic">
                Hint: Prices are entered without decimals. So for a price of 1.99
                CHF, enter 199
              </td>
            </tr>
            <tr>
              <td class="fieldName">Activation actions</td>
              <td class="fieldValue">
                <div style="overflow: auto; max-height: 400px">
                  <PurchasableAction
                      v-for="action of activationActions"
                      :action="action"
                      @remove="removeActivationAction"
                  ></PurchasableAction>
                </div>
                <v-btn @click="addActivationAction">Add action</v-btn>
              </td>
            </tr>
            <tr>
              <td class="fieldName">Deactivation actions</td>
              <td class="fieldValue">
                <div style="overflow: auto; max-height: 400px">
                  <PurchasableAction
                      v-for="action of deactivationActions"
                      :action="action"
                      @remove="removeDeactivationAction"
                  ></PurchasableAction>
                </div>
                <v-btn @click="addDeactivationAction">Add action</v-btn>
              </td>
            </tr>
          </table>
        </template>
      </SlimFormCard>
    </template>

    <template #actions>
      <v-btn
          data-test="submitCreateAttributeTemplate"
          color="primary"
          @click="submit"
      >
        <v-icon>mdi-content-save</v-icon>
        save
      </v-btn>
      <v-btn data-test="cancelCreateAttributeTemplate" @click="close">
        <v-icon>mdi-close</v-icon>
        close
      </v-btn>
    </template>
  </Dialog>
</template>

<script>

import { watch } from 'vue'
import { tools, SlimFormCard, Dialog, SmallTextField, SmallCheckbox, SmallTextArea } from "@mindcraftgmbh/nukleus-vueui";
import PurchasableOption from "./PurchasableOption.vue";
import PurchasableAction from "./PurchasableAction";

export default {
  components: {
    Dialog,
    PurchasableAction,
    SlimFormCard,
    PurchasableOption,
    SmallTextField,
    SmallCheckbox,
    SmallTextArea
  },

  // --------------------------------------------------------
  // PROPERTIES
  // --------------------------------------------------------
  props: {
    modelValue: Boolean,
    purchasableId: String,
  },

  // --------------------------------------------------------
  // EMITS
  // --------------------------------------------------------
  emits: ['update:modelValue', 'created', 'updated', 'closed'],

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    purchasable: null,
  }),

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    cssClasses: {
      get() {
        if (this.$store.state.darkMode) {
          return "slimForm slimFormDark";
        } else {
          return "slimForm slimFormLight";
        }
      },
    },
    show: {
      get() {
        return this.modelValue;
      },
      set(value) {
        this.$emit("update:modelValue", value);
      },
    },

    name: {
      get() {
        if (this.purchasable) {
          return this.purchasable.name;
        }
        return "";
      },
      set(value) {
        if (this.purchasable) {
          this.purchasable.name = value;
        }
      },
    },

    description: {
      get() {
        if (this.purchasable) {
          return this.purchasable.description;
        }
        return "";
      },
      set(value) {
        if (this.purchasable) {
          this.purchasable.description = value;
        }
      },
    },

    options: {
      get() {
        if (this.purchasable) {
          return this.purchasable.options;
        }

        return [];
      },
      set(value) {
        if (this.purchasable) {
          this.purchasable.options = value;
        }
      },
    },

    groupId: {
      get() {
        if (this.purchasable) {
          return this.purchasable.groupId;
        }

        return "";
      },
      set(value) {
        if (this.purchasable) {
          this.purchasable.groupId = value;
        }
      },
    },

    isPublic: {
      get() {
        if (this.purchasable) {
          return this.purchasable.public;
        }

        return false;
      },
      set(value) {
        if (this.purchasable) {
          this.purchasable.public = value;
        }
      },
    },

    pricesContainVat: {
      get() {
        if (this.purchasable) {
          return this.purchasable.pricesContainVat;
        }

        return false;
      },
      set(value) {
        if (this.purchasable) {
          this.purchasable.pricesContainVat = value;
        }
      },
    },

    activationActions: {
      get() {
        if (this.purchasable) {
          return this.purchasable.activationActions;
        }

        return [];
      },
      set(value) {
        if (this.purchasable) {
          this.purchasable.activationActions = value;
        }
      },
    },

    deactivationActions: {
      get() {
        if (this.purchasable) {
          return this.purchasable.deactivationActions;
        }

        return [];
      },
      set(value) {
        if (this.purchasable) {
          this.purchasable.deactivationActions = value;
        }
      },
    },
  },

  // --------------------------------------------------------
  // CREATED
  // --------------------------------------------------------
  created() {
    watch(() => [this.modelValue], (newValues) => {
      if (newValues[0]) {
        this.load();
      }
    });
  },

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    async load() {
      try {
        if (this.purchasableId) {
          this.purchasable = await this.$store.state.nkclient.getPurchasable(
            this.purchasableId,
          );
          console.log(this.purchasable);
        } else {
          this.purchasable = {
            name: "",
            description: "",
            options: [],
            groupId: "",
            isPublic: false,
            pricesContainVat: false,
            activationActions: [],
            deactivationActions: [],
          };
        }
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    async addOption() {
      const supportedCurrencies =
        await this.$store.state.nkclient.getSupportedCurrencies();

      const prices = {};
      for (const currency of supportedCurrencies) {
        prices[currency] = 0;
      }

      this.options.push({
        _id: tools.createGUID(),
        name: "Option name",
        prices: prices,
        interval: "once",
      });
    },
    removeOption(option) {
      this.options = this.options.filter((x) => x._id !== option._id);
    },
    addActivationAction() {
      this.activationActions.push({
        _id: tools.createGUID(),
        type: "",
        params: "",
      });
    },
    removeActivationAction(action) {
      this.activationActions = this.activationActions.filter(
        (x) => x._id !== action._id,
      );
    },
    addDeactivationAction() {
      this.deactivationActions.push({
        _id: tools.createGUID(),
        type: "",
        params: "",
      });
    },
    removeDeactivationAction(action) {
      this.deactivationActions = this.deactivationActions.filter(
        (x) => x._id !== action._id,
      );
    },
    async submit() {
      try {
        function cloneAndRemoveHelperIds(array) {
          array = JSON.parse(JSON.stringify(array));

          for (const row of array) {
            if (row._id && row._id.length > 24) delete row._id;
          }

          return array;
        }

        // remove created IDs from options before sending, they're just helpers
        const options = cloneAndRemoveHelperIds(this.options);
        const activationActions = cloneAndRemoveHelperIds(
          this.activationActions,
        );
        const deactivationActions = cloneAndRemoveHelperIds(
          this.deactivationActions,
        );

        const purchasable = {
          name: this.purchasable.name,
          description: this.purchasable.description,
          options: options,
          groupId: this.purchasable.groupId,
          public: this.purchasable.public,
          pricesContainVat: this.purchasable.pricesContainVat,
          activationActions: activationActions,
          deactivationActions: deactivationActions,
        };

        if (!this.purchasable._id) {
          const id =
            await this.$store.state.nkclient.createPurchasable(purchasable);
          this.$emit("created", id);
        } else {
          purchasable._id = this.purchasable._id;
          await this.$store.state.nkclient.updatePurchasable(purchasable);
          this.$emit("updated", purchasable._id);
        }

        this.close();
      } catch (err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },
    close() {
      this.show = false;
      this.$emit("closed");
    },
  },
};
</script>

<style></style>
