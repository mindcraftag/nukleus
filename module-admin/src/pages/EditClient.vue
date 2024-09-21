<template>
  <div>
    <h1 class="pageTitle" data-test="editClientTitle">Edit client</h1>

    <v-container fluid grid-list-xl>
      <v-layout row wrap>

        <v-flex d-flex lg12 sm12 xs12>

          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <v-btn color="primary" @click="submit">
                    <v-icon>mdi-content-save</v-icon>
                    save
                  </v-btn>
                  <v-btn @click="close">
                    <v-icon>mdi-close</v-icon>
                    close
                  </v-btn>

                </v-flex>
              </v-layout>
            </v-container>
          </v-card>

        </v-flex>
        <v-flex d-flex lg4 md6 sm12 xs12>

          <v-card width="100%">
            <v-card-title>Basic info</v-card-title>
            <v-card-text>
              <table :class="cssClasses" style="width: 100%">
                <tr>
                  <td class="fieldName">
                    Name
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        v-model="name"
                        required
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    EMail
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        v-model="email"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    Name on invoice (optional)
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        v-model="addressName"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    Street
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        v-model="street"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    Zipcode
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        v-model="zipcode"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    City
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        v-model="city"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    Country
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        v-model="country"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    VAT ID
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        v-model="vatNo"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    Current plan
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        v-model="currentPlanName"
                        readonly
                        required
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    Switch to plan
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-select :items="plans"
                                v-model="nextPlan"
                                item-text="name"
                                item-value="_id"
                                clearable
                                dense>
                      </v-select>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    Draft Mode
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-select :items="draftModes"
                                v-model="draftMode"
                                item-text="name"
                                item-value="id"
                                dense>
                      </v-select>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName">
                    Draft Grace Period (Days)
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-text-field
                        v-model="draftGracePeriodDays"
                        type="number"
                      ></v-text-field>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Functionality</v-card-title>
            <v-card-text>
              <table :class="cssClasses" style="width: 100%;">
                <tr>
                  <td class="fieldName50">
                    Conversation mode
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-select :items="conversationModes"
                                v-model="conversationMode"
                                v-if="conversationsAllowed"
                                dense>
                      </v-select>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName50">
                    Payment system enabled
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="paymentEnabled"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName50">
                    Mailing system enabled
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="mailingEnabled"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName50">
                    Public download allowed
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="publicDownloadAllowed"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName50">
                    Public query allowed
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="publicQueryAllowed"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName50">
                    Conversations can be public
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="publicConversations"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName50">
                    Likes can be public
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="publicLikes"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName50">
                    Categories are public
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="publicCategories"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName50">
                    Licenses are public
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="publicLicenses"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName50">
                    User information is public
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="publicUserInfo"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName50">
                    User/Group features enabled
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="enabledUserAndGroupFeatures"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName50">
                    User/Group datatypes enabled
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="enabledUserAndGroupDatatypes"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName50">
                    User/Group jobtypes enabled
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="enabledUserAndGroupJobtypes"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td class="fieldName50">
                    Invitation token enabled
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox
                        class="slimFormCheckbox"
                        v-model="invitationTokenEnabled"
                        dense hide-details
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
              </table>

              <v-alert v-if="invitationTokenEnabled && invitationToken.length === 0"
                       type="info"
                       border="left">
                After enabling the invitation token, save the client. The token will then be generated serverside and will be visible
                after reopening this page.
              </v-alert>
              <v-text-field
                v-model="invitationToken"
                label="Invitation token"
                v-if="invitationToken.length > 0"
                readonly
                required
              ></v-text-field>

            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Storage</v-card-title>
            <v-card-text>

              <v-card flat>
                <v-card-title>Enabled storages</v-card-title>
                <v-card-text>
                  <span v-if="storages.length === 0">No storages available</span>
                  <table :class="cssClasses" style="width: 100%;">
                    <tr v-for="storage in storages" :key="storage._id">
                      <td class="fieldName70">
                        {{ getFeatureLabel(storage) }}
                      </td>
                      <td class="fieldValue">
                        <div class="fieldValueContainer">
                          <v-checkbox class="slimFormCheckbox"
                                      v-model="storage.active"
                                      :readonly="storage.inherited"
                                      :color="storage.inherited ? 'white' : 'blue'"
                                      hide-details
                                      dense
                          ></v-checkbox>
                        </div>
                      </td>
                    </tr>
                  </table>
                </v-card-text>
              </v-card>

              <v-card flat>
                <v-card-title>Quotas</v-card-title>
                <v-card-text>

                  <table :class="cssClasses" style="width: 100%;">
                    <tr>
                      <td class="fieldName70">
                        User Storage Quota enabled
                      </td>
                      <td class="fieldValue">
                        <div class="fieldValueContainer">
                          <v-checkbox
                            class="slimFormCheckbox"
                            v-model="userStorageQuotaEnabled"
                            dense hide-details
                          ></v-checkbox>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="userStorageQuotaEnabled">
                      <td class="fieldName70">
                        User Storage Quota (GiB)
                      </td>
                      <td class="fieldValue">
                        <div class="fieldValueContainer">
                          <v-text-field
                            v-model="defaultUserStorageQuotaGb"
                            type="number"
                          ></v-text-field>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td class="fieldName70">
                        Group Storage Quota enabled
                      </td>
                      <td class="fieldValue">
                        <div class="fieldValueContainer">
                          <v-checkbox
                            class="slimFormCheckbox"
                            v-model="groupStorageQuotaEnabled"
                            dense hide-details
                          ></v-checkbox>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="groupStorageQuotaEnabled">
                      <td class="fieldName70">
                        Group Storage Quota (GiB)
                      </td>
                      <td class="fieldValue">
                        <div class="fieldValueContainer">
                          <v-text-field
                            v-model="defaultGroupStorageQuotaGb"
                            type="number"
                          ></v-text-field>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td class="fieldName70">
                        User Traffic Quota enabled
                      </td>
                      <td class="fieldValue">
                        <div class="fieldValueContainer">
                          <v-checkbox
                            class="slimFormCheckbox"
                            v-model="userTrafficQuotaEnabled"
                            dense hide-details
                          ></v-checkbox>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="userTrafficQuotaEnabled">
                      <td class="fieldName70">
                        User Traffic Quota (GiB)
                      </td>
                      <td class="fieldValue">
                        <div class="fieldValueContainer">
                          <v-text-field
                            v-model="defaultUserTrafficQuotaGb"
                            type="number"
                          ></v-text-field>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td class="fieldName70">
                        Group Traffic Quota enabled
                      </td>
                      <td class="fieldValue">
                        <div class="fieldValueContainer">
                          <v-checkbox
                            class="slimFormCheckbox"
                            v-model="groupTrafficQuotaEnabled"
                            dense hide-details
                          ></v-checkbox>
                        </div>
                      </td>
                    </tr>
                    <tr v-if="groupTrafficQuotaEnabled">
                      <td class="fieldName70">
                        Group Traffic Quota (GiB)
                      </td>
                      <td class="fieldValue">
                        <div class="fieldValueContainer">
                          <v-text-field
                            v-model="defaultGroupTrafficQuotaGb"
                            type="number"
                          ></v-text-field>
                        </div>
                      </td>
                    </tr>
                  </table>

                </v-card-text>
              </v-card>

            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Allowed datatypes</v-card-title>
            <v-card-text>
              <span v-if="datatypes.length === 0">No datatypes available</span>
              <table :class="cssClasses" style="width: 100%;">
                <tr v-for="datatype in datatypes" :key="datatype.name">
                  <td class="fieldName70">
                    {{ getFeatureLabel(datatype) }}
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox class="slimFormCheckbox"
                                  v-model="datatype.active"
                                  :readonly="datatype.inherited"
                                  :color="datatype.inherited ? 'white' : 'blue'"
                                  @click="updatedDatatypes"
                                  hide-details
                                  dense
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Allowed jobtypes</v-card-title>
            <v-card-text>
              <span v-if="jobtypes.length === 0">No jobtypes available</span>
              <table :class="cssClasses" style="width: 100%;">
                <tr v-for="jobtype in jobtypes" :key="jobtype.name">
                  <td class="fieldName70">
                    {{ getFeatureLabel(jobtype) }}
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox class="slimFormCheckbox"
                                  v-model="jobtype.active"
                                  :readonly="jobtype.inherited"
                                  :color="jobtype.inherited ? 'white' : 'blue'"
                                  @click="updatedJobtypes"
                                  hide-details
                                  dense
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Allowed features</v-card-title>
            <v-card-text>
              <span v-if="features.length === 0">No features available</span>
              <table :class="cssClasses" style="width: 100%;">
                <tr v-for="feature in features" :key="feature.name">
                  <td class="fieldName70">
                    {{ getFeatureLabel(feature) }}
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox class="slimFormCheckbox"
                                  v-model="feature.active"
                                  :readonly="feature.inherited"
                                  :color="feature.inherited ? 'white' : 'blue'"
                                  @click="updatedFeatures"
                                  hide-details
                                  dense
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12 v-if="enabledUserAndGroupDatatypes">
          <v-card width="100%">
            <v-card-title>Datatypes for all</v-card-title>
            <v-card-text>
              <span v-if="enabledDatatypes.length === 0">No datatypes available</span>
              <table :class="cssClasses" style="width: 100%;">
                <tr v-for="datatype in enabledDatatypes" :key="datatype.name">
                  <td class="fieldName70">
                    {{ datatype.name }}
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox class="slimFormCheckbox"
                                  v-model="datatype.activeForAll"
                                  hide-details
                                  dense
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12 v-if="enabledUserAndGroupJobtypes">
          <v-card width="100%">
            <v-card-title>Jobtypes for all</v-card-title>
            <v-card-text>
              <span v-if="enabledJobtypes.length === 0">No jobtypes available</span>
              <table :class="cssClasses" style="width: 100%;">
                <tr v-for="jobtype in enabledJobtypes" :key="jobtype.name">
                  <td class="fieldName70">
                    {{ jobtype.name }}
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox class="slimFormCheckbox"
                                  v-model="jobtype.activeForAll"
                                  hide-details
                                  dense
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12 v-if="enabledUserAndGroupFeatures">
          <v-card width="100%">
            <v-card-title>Features for all</v-card-title>
            <v-card-text>
              <span v-if="enabledFeatures.length === 0">No features available</span>
              <table :class="cssClasses" style="width: 100%;">
                <tr v-for="feature in enabledFeatures" :key="feature.name">
                  <td class="fieldName70">
                    {{ feature.displayName }}
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox class="slimFormCheckbox"
                                  v-model="feature.activeForAll"
                                  hide-details
                                  dense
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Allowed modules</v-card-title>
            <v-card-text>
              <span v-if="plugins.length === 0">No modules available</span>
              <table :class="cssClasses" style="width: 100%;">
                <tr v-for="plugin in plugins" :key="plugin.name">
                  <td class="fieldName70">
                    {{ getFeatureLabel(plugin) }}
                  </td>
                  <td class="fieldValue">
                    <div class="fieldValueContainer">
                      <v-checkbox class="slimFormCheckbox"
                                  v-model="plugin.active"
                                  :readonly="plugin.inherited"
                                  :color="plugin.inherited ? 'white' : 'blue'"
                                  hide-details
                                  dense
                      ></v-checkbox>
                    </div>
                  </td>
                </tr>
              </table>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Categories</v-card-title>
            <v-card-text>
              <div style="max-height: 400px; overflow: auto;">
                <CategoriesEditor v-model="categories"></CategoriesEditor>
              </div>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Licenses</v-card-title>
            <v-card-text>
              <div style="max-height: 400px; overflow: auto;">
                <LicensesEditor v-model="licenses"></LicensesEditor>
              </div>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Access control</v-card-title>
            <v-card-text>
              <div style="max-height: 400px; overflow: auto;">
                <AclEditor :element="client" :allow-edit="true" :client-mode="true"></AclEditor>
              </div>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Mailing</v-card-title>
            <v-card-text>
              <div style="max-height: 400px; overflow: auto;">
                <table :class="cssClasses" style="width: 100%">
                  <tr>
                    <td class="fieldName">
                      Mailer name
                    </td>
                    <td class="fieldValue">
                      <div class="fieldValueContainer">
                        <v-text-field
                          v-model="mailerName"
                          required
                        ></v-text-field>
                      </div>
                    </td>
                  </tr>
                  <tr>
                    <td class="fieldName">
                      Mailer address
                    </td>
                    <td class="fieldValue">
                      <div class="fieldValueContainer">
                        <v-text-field
                          v-model="mailerAddress"
                          required
                        ></v-text-field>
                      </div>
                    </td>
                  </tr>
                </table>
              </div>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg4 md6 sm12 xs12>
          <v-card width="100%">
            <v-card-title>User Properties Template</v-card-title>
            <v-card-text>
              <div style="max-height: 400px; overflow: auto;">
                <v-textarea
                  class="jsonTextarea"
                  :error-messages="userPropertiesTemplateErrors"
                  spellcheck="false"
                    v-model="userPropertiesTemplateString"
                    required
                    @blur="() => {
                      if (userPropertiesTemplateErrors.length === 0) {
                        userPropertiesTemplateString = JSON.stringify(JSON.parse(userPropertiesTemplateString), null, 4);
                      }
                    }"
                  >
                </v-textarea>
              </div>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg12 md12 sm12 xs12>
          <v-card width="100%">
            <v-card-title>Invoices</v-card-title>
            <v-card-text>
              <div style="max-height: 400px; overflow: auto;">
                <InvoicesList :clientId="clientId"></InvoicesList>
              </div>
            </v-card-text>
          </v-card>
        </v-flex>

        <v-flex d-flex lg12 sm12 xs12>
          <v-card width="100%">
            <v-container fluid grid-list-lg>
              <v-layout row wrap>
                <v-flex xs12>

                  <v-btn color="primary" @click="submit">
                    <v-icon>mdi-content-save</v-icon>
                    save
                  </v-btn>
                  <v-btn @click="close">
                    <v-icon>mdi-close</v-icon>
                    close
                  </v-btn>

                </v-flex>
              </v-layout>
            </v-container>
          </v-card>

        </v-flex>

      </v-layout>
    </v-container>
  </div>
</template>

<script>

import InvoicesList from '../components/InvoicesList'
import { AclEditor } from '@mindcraftgmbh/nukleus-vueui'
import CategoriesEditor from "../components/CategoriesEditor";
import LicensesEditor from "../components/LicensesEditor";

export default {

  components: {
    CategoriesEditor,
    AclEditor,
    InvoicesList,
    LicensesEditor
  },

  // --------------------------------------------------------
  // COMPUTED
  // --------------------------------------------------------
  computed: {
    cssClasses: {
      get() {
        if (this.$vuetify.theme.dark) {
          return "slimForm slimFormDark";
        } else {
          return "slimForm slimFormLight";
        }
      }
    },
    clientId: {
      get() {
        if (this.client) {
          return this.client._id;
        }
        return null;
      },
    },
    name: {
      get() {
        if (this.client) {
          return this.client.name;
        }
        return "";
      },
      set(value) {
        if (this.client) {
          this.client.name = value;
        }
      }
    },
    email: {
      get() {
        if (this.client) {
          if (!this.client.paymentSetup.address)
            this.client.paymentSetup.address = {};
          return this.client.paymentSetup.address.email;
        }
        return "";
      },
      set(value) {
        if (this.client) {
          if (!this.client.paymentSetup.address)
            this.client.paymentSetup.address = {};
          this.client.paymentSetup.address.email = value;
        }
      }
    },
    addressName: {
      get() {
        if (this.client) {
          if (!this.client.paymentSetup.address)
            this.client.paymentSetup.address = {};
          return this.client.paymentSetup.address.name;
        }
        return "";
      },
      set(value) {
        if (this.client) {
          if (!this.client.paymentSetup.address)
            this.client.paymentSetup.address = {};
          this.client.paymentSetup.address.name = value;
        }
      }
    },
    street: {
      get() {
        if (this.client && this.client.paymentSetup.address) {
          return this.client.paymentSetup.address.street;
        }
        return "";
      },
      set(value) {
        if (this.client && this.client.paymentSetup.address) {
          this.client.paymentSetup.address.street = value;
        }
      }
    },
    zipcode: {
      get() {
        if (this.client && this.client.paymentSetup.address) {
          return this.client.paymentSetup.address.zipcode;
        }
        return "";
      },
      set(value) {
        if (this.client && this.client.paymentSetup.address) {
          this.client.paymentSetup.address.zipcode = value;
        }
      }
    },
    city: {
      get() {
        if (this.client && this.client.paymentSetup.address) {
          return this.client.paymentSetup.address.city;
        }
        return "";
      },
      set(value) {
        if (this.client && this.client.paymentSetup.address) {
          this.client.paymentSetup.address.city = value;
        }
      }
    },
    country: {
      get() {
        if (this.client && this.client.paymentSetup.address) {
          return this.client.paymentSetup.address.country;
        }
        return "";
      },
      set(value) {
        if (this.client && this.client.paymentSetup.address) {
          this.client.paymentSetup.address.country = value;
        }
      }
    },
    vatNo: {
      get() {
        if (this.client) {
          return this.client.paymentSetup.vatNo;
        }
        return "";
      },
      set(value) {
        if (this.client) {
          this.client.paymentSetup.vatNo = value;
        }
      }
    },
    currentPlanName: {
      get() {
        if (this.client) {
          return this.client.currentPlanName;
        }
        return "";
      }
    },
    nextPlan: {
      get() {
        if (this.client) {
          return this.client.nextPlan;
        }
        return null;
      },
      set(value) {
        if (this.client) {
          this.client.nextPlan = value;
        }
      }
    },
    draftMode: {
      get() {
        if (this.client) {
          return this.client.draftMode;
        }
        return null;
      },
      set(value) {
        if (this.client) {
          this.client.draftMode = value;
        }
      }
    },
    draftGracePeriodDays: {
      get() {
        if (this.client) {
          return this.client.draftGracePeriodDays;
        }
        return 0;
      },
      set(value) {
        if (this.client) {
          this.client.draftGracePeriodDays = value;
        }
      }
    },
    conversationsAllowed: {
      get() {
        if (this.plan) {
          return this.plan.conversationsAllowed;
        }
        return false;
      }
    },
    conversationMode: {
      get() {
        if (this.client) {
          return this.client.conversationMode || 0;
        }
        return 0;
      },
      set(value) {
        if (this.client) {
          this.client.conversationMode = value;
        }
      }
    },
    paymentEnabled: {
      get() {
        if (this.client) {
          return this.client.paymentEnabled;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.paymentEnabled = value;
        }
      }
    },
    mailingEnabled: {
      get() {
        if (this.client) {
          return this.client.mailingEnabled;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.mailingEnabled = value;
        }
      }
    },
    publicDownloadAllowed: {
      get() {
        if (this.client) {
          return this.client.publicDownloadAllowed;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.publicDownloadAllowed = value;
        }
      }
    },
    publicQueryAllowed: {
      get() {
        if (this.client) {
          return this.client.publicQueryAllowed;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.publicQueryAllowed = value;
        }
      }
    },
    publicConversations: {
      get() {
        if (this.client) {
          return this.client.publicConversations;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.publicConversations = value;
        }
      }
    },
    publicLikes: {
      get() {
        if (this.client) {
          return this.client.publicLikes;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.publicLikes = value;
        }
      }
    },
    publicCategories: {
      get() {
        if (this.client) {
          return this.client.publicCategories;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.publicCategories = value;
        }
      }
    },
    publicLicenses: {
      get() {
        if (this.client) {
          return this.client.publicLicenses;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.publicLicenses = value;
        }
      }
    },
    publicUserInfo: {
      get() {
        if (this.client) {
          return this.client.publicUserInfo;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.publicUserInfo = value;
        }
      }
    },
    userStorageQuotaEnabled: {
      get() {
        if (this.client) {
          return this.client.defaultUserStorageQuotaGb !== null && this.client.defaultUserStorageQuotaGb !== undefined;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          if (value)
            this.client.defaultUserStorageQuotaGb = 0;
          else
            this.client.defaultUserStorageQuotaGb = null;
        }
      }
    },
    defaultUserStorageQuotaGb: {
      get() {
        if (this.client) {
          return this.client.defaultUserStorageQuotaGb;
        }
        return 0;
      },
      set(value) {
        if (this.client) {
          this.client.defaultUserStorageQuotaGb = parseInt(value);
        }
      }
    },
    groupStorageQuotaEnabled: {
      get() {
        if (this.client) {
          return this.client.defaultGroupStorageQuotaGb !== null && this.client.defaultGroupStorageQuotaGb !== undefined;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          if (value)
            this.client.defaultGroupStorageQuotaGb = 0;
          else
            this.client.defaultGroupStorageQuotaGb = null;
        }
      }
    },
    defaultGroupStorageQuotaGb: {
      get() {
        if (this.client) {
          return this.client.defaultGroupStorageQuotaGb;
        }
        return 0;
      },
      set(value) {
        if (this.client) {
          this.client.defaultGroupStorageQuotaGb = parseInt(value);
        }
      }
    },
    userTrafficQuotaEnabled: {
      get() {
        if (this.client) {
          return this.client.defaultUserTrafficQuotaGb !== null && this.client.defaultUserTrafficQuotaGb !== undefined;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          if (value)
            this.client.defaultUserTrafficQuotaGb = 0;
          else
            this.client.defaultUserTrafficQuotaGb = null;
        }
      }
    },
    defaultUserTrafficQuotaGb: {
      get() {
        if (this.client) {
          return this.client.defaultUserTrafficQuotaGb;
        }
        return 0;
      },
      set(value) {
        if (this.client) {
          this.client.defaultUserTrafficQuotaGb = parseInt(value);
        }
      }
    },
    groupTrafficQuotaEnabled: {
      get() {
        if (this.client) {
          return this.client.defaultGroupTrafficQuotaGb !== null && this.client.defaultGroupTrafficQuotaGb !== undefined;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          if (value)
            this.client.defaultGroupTrafficQuotaGb = 0;
          else
            this.client.defaultGroupTrafficQuotaGb = null;
        }
      }
    },
    defaultGroupTrafficQuotaGb: {
      get() {
        if (this.client) {
          return this.client.defaultGroupTrafficQuotaGb;
        }
        return 0;
      },
      set(value) {
        if (this.client) {
          this.client.defaultGroupTrafficQuotaGb = parseInt(value);
        }
      }
    },
    invitationToken: {
      get() {
        if (this.client) {
          return this.client.invitationToken || "";
        }
        return "";
      }
    },
    invitationTokenEnabled: {
      get() {
        if (this.client) {
          return this.client.invitationTokenEnabled;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.invitationTokenEnabled = value;
        }
      }
    },
    enabledUserAndGroupFeatures: {
      get() {
        if (this.client) {
          return this.client.enabledUserAndGroupFeatures;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.enabledUserAndGroupFeatures = value;
        }
      }
    },
    enabledUserAndGroupJobtypes: {
      get() {
        if (this.client) {
          return this.client.enabledUserAndGroupJobtypes;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.enabledUserAndGroupJobtypes = value;
        }
      }
    },
    enabledUserAndGroupDatatypes: {
      get() {
        if (this.client) {
          return this.client.enabledUserAndGroupDatatypes;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.enabledUserAndGroupDatatypes = value;
        }
      }
    },
    mailerName: {
      get() {
        if (this.client) {
          return this.client.mailerName;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.mailerName = value;
        }
      }
    },
    mailerAddress: {
      get() {
        if (this.client) {
          return this.client.mailerAddress;
        }
        return false;
      },
      set(value) {
        if (this.client) {
          this.client.mailerAddress = value;
        }
      }
    },
    enabledJobtypes() {
      return this.jobtypes.filter(x => x.active);
    },
    enabledDatatypes() {
      return this.datatypes.filter(x => x.active);
    },
    enabledFeatures() {
      return this.features.filter(x => x.active);
    }
  },

  watch: {
    userPropertiesTemplateString(value) {
      try {
        const json = JSON.parse(value);
        this.client.userPropertiesTemplate = json;
        this.userPropertiesTemplateErrors = [];
      } catch(e) {
        this.userPropertiesTemplateErrors = ['Invalid JSON (enclose keys in quotes, no trailing commas)'];
      }
    }
  },

  // --------------------------------------------------------
  // DATA
  // --------------------------------------------------------
  data: () => ({
    client: null,
    plan: null,
    plans: [],
    categories: [],
    licenses: [],
    licensesIds: [],
    datatypes: [],
    jobtypes: [],
    plugins: [],
    features: [],
    storages: [],
    conversationModes: [
      { value: 0, text: "Always off" },
      { value: 1, text: "Always on" },
      { value: 2, text: "Settable per item" }
    ],
    draftModes: [{
      name: "Forever",
      id: "FOREVER"
    },{
      name: "Make Public After Grace Period",
      id: "PUBLIC_AFTER_GRACE"
    },{
      name: "Delete After Grace Period",
      id: "DELETE_AFTER_GRACE"
    }],
    userPropertiesTemplateString: "",
    userPropertiesTemplateErrors: []
  }),

  // --------------------------------------------------------
  // METHODS
  // --------------------------------------------------------
  methods: {
    getFeatureLabel(item) {
      const name = item.displayName || item.name;
      return name + (item.inherited ? ' (inherited)' : '');
    },

    updatedJobtypes() {
      const jobtypes = this.jobtypes;
      this.$set(this, 'jobtypes', []);
      this.$set(this, 'jobtypes', jobtypes);
    },

    updatedDatatypes() {
      const datatypes = this.datatypes;
      this.$set(this, 'datatypes', []);
      this.$set(this, 'datatypes', datatypes);
    },

    updatedFeatures() {
      const features = this.features;
      this.$set(this, 'features', []);
      this.$set(this, 'features', features);
    },

    async loadClient() {
      try {
        const clientId = this.$router.currentRoute.params.id;

        this.plans = await this.$store.state.nkclient.getPlans();

        const client = await this.$store.state.nkclient.getClient(clientId);
        let currentPlan = null;

        for (const plan of this.plans) {
          if (plan._id === client.currentPlan) {
            client.currentPlanName = plan.name;
            currentPlan = plan;
          }
        }

        const categories = await this.$store.state.nkclient.getCategoriesInClient(clientId);
        categories.sort((a, b) => { return a.name.localeCompare(b.name); });
        this.categories = categories;

        const licenses = await this.$store.state.nkclient.getLicensesInClient(clientId);
        licenses.sort((a, b) => { return a.name.localeCompare(b.name); });
        this.licenses = licenses;
        this.licensesIds = licenses.map(x => x._id);

        // make sure this is not undefined or it cannot be reactive
        client.defaultUserStorageQuotaGb = client.defaultUserStorageQuotaGb || null;
        client.defaultGroupStorageQuotaGb = client.defaultGroupStorageQuotaGb || null;
        client.defaultUserTrafficQuotaGb = client.defaultUserTrafficQuotaGb || null;
        client.defaultGroupTrafficQuotaGb = client.defaultGroupTrafficQuotaGb || null;

        this.client = client;
        this.userPropertiesTemplateString = JSON.stringify(this.client.userPropertiesTemplate, null, 4);

        const features = await this.$store.state.nkclient.getAllFeatures();
        features.sort((a, b) => { return a.displayName.localeCompare(b.displayName); });
        this.features = features;

        const storages = await this.$store.state.nkclient.getStorages();
        storages.sort((a, b) => { return a.name.localeCompare(b.name); });
        this.storages = storages;

        const datatypes = await this.$store.state.nkclient.getAllDatatypesList();
        datatypes.sort((a, b) => { return a.name.localeCompare(b.name); });
        this.datatypes = datatypes;

        const jobtypes = await this.$store.state.nkclient.getAllManualJobTypesForClient(clientId);
        jobtypes.sort((a, b) => { return a.name.localeCompare(b.name); });
        this.jobtypes = jobtypes;

        const plugins = await this.$store.state.nkclient.getPlugins();
        jobtypes.sort((a, b) => { return a.name.localeCompare(b.name); });
        this.plugins = plugins;

        if (Array.isArray(this.client.storages)) {
          for (const storage of this.storages) {
            const active = this.client.storages.includes(storage._id);
            const inherited = Array.isArray(currentPlan.storages) ?
              currentPlan.storages.includes(storage._id) : false;
            storage.active = active || inherited;
            storage.inherited = inherited;
          }
        }

        if (Array.isArray(this.client.datatypesEnabled)) {
          for (const datatype of this.datatypes) {
            const active = this.client.datatypesEnabled.includes(datatype.name);
            const activeForAll = this.client.datatypesEnabledForAll.includes(datatype.name);
            const inherited = Array.isArray(currentPlan.datatypesEnabled) ?
              currentPlan.datatypesEnabled.includes(datatype.name) : false;
            datatype.active = active || inherited;
            datatype.activeForAll = activeForAll;
            datatype.inherited = inherited;
          }

          this.updatedDatatypes();
        }

        if (Array.isArray(this.client.jobtypesEnabled)) {
          for (const jobtype of this.jobtypes) {
            const active =this.client.jobtypesEnabled.includes(jobtype.name);
            const activeForAll = this.client.jobtypesEnabledForAll.includes(jobtype.name);
            const inherited = Array.isArray(currentPlan.jobtypesEnabled) ?
              currentPlan.jobtypesEnabled.includes(jobtype.name) : false;
            jobtype.active = active || inherited;
            jobtype.activeForAll = activeForAll;
            jobtype.inherited = inherited;
          }

          this.updatedJobtypes();
        }

        if (Array.isArray(this.client.featuresEnabled)) {
          for (const feature of this.features) {
            const active = this.client.featuresEnabled.includes(feature.name);
            const activeForAll = this.client.featuresEnabledForAll.includes(feature.name);
            const inherited = Array.isArray(currentPlan.featuresEnabled) ?
              currentPlan.featuresEnabled.includes(feature.name) : false;
            feature.active = active || inherited;
            feature.activeForAll = activeForAll;
            feature.inherited = inherited;
          }

          this.updatedFeatures();
        }

        if (Array.isArray(this.client.pluginsEnabled)) {
          for (const plugin of this.plugins) {
            const active = this.client.pluginsEnabled.includes(plugin.name);
            const inherited = Array.isArray(currentPlan.pluginsEnabled) ?
              currentPlan.pluginsEnabled.includes(plugin.name) : false;
            plugin.active = active || inherited;
            plugin.inherited = inherited;
          }
        }

        this.plan = currentPlan;
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    async submit () {
      try {
        // create a list of all enabled storages
        const storagesEnabled = [];
        for (const storage of this.storages) {
          if (storage.active && !storage.inherited) {
            storagesEnabled.push(storage._id);
          }
        }

        // create a list of all enabled datatypes
        const datatypesEnabled = [];
        const datatypesEnabledForAll = [];
        for (const datatype of this.datatypes) {
          if (datatype.active && !datatype.inherited) {
            datatypesEnabled.push(datatype.name);
          }
          if (this.client.enabledUserAndGroupDatatypes) {
            if (datatype.activeForAll && (datatype.active || datatype.inherited)) {
              datatypesEnabledForAll.push(datatype.name);
            }
          }
        }

        // create a list of all enabled jobtypes
        const jobtypesEnabled = [];
        const jobtypesEnabledForAll = [];
        for (const jobtype of this.jobtypes) {
          if (jobtype.active && !jobtype.inherited) {
            jobtypesEnabled.push(jobtype.name);
          }
          if (this.client.enabledUserAndGroupJobtypes) {
            if (jobtype.activeForAll && (jobtype.active || jobtype.inherited)) {
              jobtypesEnabledForAll.push(jobtype.name);
            }
          }
        }

        // create a list of all enabled features
        const featuresEnabled = [];
        const featuresEnabledForAll = [];
        for (const feature of this.features) {
          if (feature.active && !feature.inherited) {
            featuresEnabled.push(feature.name);
          }
          if (this.client.enabledUserAndGroupFeatures) {
            if (feature.activeForAll && (feature.active || feature.inherited)) {
              featuresEnabledForAll.push(feature.name);
            }
          }
        }

        // create a list of all enabled plugins
        const pluginsEnabled = [];
        for (const plugin of this.plugins) {
          if (plugin.active && !plugin.inherited) {
            pluginsEnabled.push(plugin.name);
          }
        }

        this.client.invitationTokenEnabled = !!this.client.invitationTokenEnabled;
        this.client.publicDownloadAllowed = !!this.client.publicDownloadAllowed;
        this.client.publicConversations = !!this.client.publicConversations;
        this.client.publicLikes = !!this.client.publicLikes;
        this.client.publicCategories = !!this.client.publicCategories;
        this.client.publicLicenses = !!this.client.publicLicenses;
        this.client.publicUserInfo = !!this.client.publicUserInfo;
        this.client.paymentEnabled = !!this.client.paymentEnabled;
        this.client.mailingEnabled = !!this.client.mailingEnabled;
        this.client.enabledUserAndGroupJobtypes = !!this.client.enabledUserAndGroupJobtypes;
        this.client.enabledUserAndGroupDatatypes = !!this.client.enabledUserAndGroupDatatypes;
        this.client.enabledUserAndGroupFeatures = !!this.client.enabledUserAndGroupFeatures;
        this.client.datatypesEnabled = datatypesEnabled;
        this.client.jobtypesEnabled = jobtypesEnabled;
        this.client.featuresEnabled = featuresEnabled;
        this.client.datatypesEnabledForAll = datatypesEnabledForAll;
        this.client.jobtypesEnabledForAll = jobtypesEnabledForAll;
        this.client.featuresEnabledForAll = featuresEnabledForAll;
        this.client.pluginsEnabled = pluginsEnabled;
        this.client.storages = storagesEnabled;

        // filter out the fake unique IDs from the categories that start with #
        const categories = this.categories.map(cat => { return {
          _id: cat._id.startsWith("#") ? null : cat._id,
          name: cat.name
        }});

        await Promise.all([
          this.$store.state.nkclient.updateClient(this.client),
          this.$store.state.nkclient.updateCategoriesInClient(this.client._id, categories)
        ]);

        // Save Licenses
        // --------------------------------------------------------------------
        const promises = [];
        const licenseIds = [];

        for (const license of this.licenses) {
          if (license._id.startsWith("#")) {
            license.client = this.client._id;
            promises.push(this.$store.state.nkclient.createLicense(license));
          } else {
            promises.push(this.$store.state.nkclient.updateLicense(license));
            licenseIds.push(license._id);
          }
        }

        for (const licenseId of this.licensesIds) {
          if (!licenseIds.includes(licenseId)) {
            promises.push(this.$store.state.nkclient.deleteLicense(licenseId, this.client._id));
          }
        }

        await Promise.all(promises);

        this.close();
      }
      catch(err) {
        console.error(err);
        this.$store.commit("setError", err.toString());
      }
    },

    close () {
      this.$router.push({name: "Clients"});
    }
  },

  created() {
    this.loadClient();
  }
}
</script>

<style scoped>
.jsonTextarea >>> textarea {
    font-family: monospace !important;
    font-size: 14px !important;
    line-height: 18px !important;
    min-height: 200px;
  }
</style>
