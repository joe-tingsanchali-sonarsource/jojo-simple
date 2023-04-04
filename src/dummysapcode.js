sap.ui.define(
	[
		"sap/ui/core/mvc/Controller",
		"sap/ui/model/json/JSONModel",
		"sap/m/MessageToast",
		"cockpit/common/BackendUtil",
		"cockpit/credstore/Messages",
		"sap/m/MessageBox",
		"cockpit/credstore/formatters/AuthenticationTypeFormatter",
		"cockpit/credstore/formatters/AccessPolicyFormatter",
		"cockpit/credstore/formatters/MultiTenancyModeFormatter",
		"cockpit/credstore/formatters/EncryptionKeysFormatter",
		"cockpit/credstore/formatters/EncryptionLevelFormatter",
		"cockpit/credstore/formatters/BindingTypeFormatter",
		"cockpit/credstore/Constants",
		"cockpit/credstore/service/CredstoreService",
		"cockpit/credstore/utils/CredstoreUtils",
		"cockpit/common/DataExport",
		"cockpit/booster/core/HttpUtil",
		"sap/ui/core/mvc/XMLView"
	],
	function(
		Controller,
		JSONModel,
		MessageToast,
		BackendUtil,
		Messages,
		MessageBox,
		AuthenticationTypeFormatter,
		AccessPolicyFormatter,
		MultiTenancyModeFormatter,
		EncryptionKeysFormatter,
		EncryptionLevelFormatter,
		BindingTypeFormatter,
		Constants,
		CredstoreService,
		CredstoreUtils,
		DataExport,
		HttpUtil,
		XMLView
	) {
		"use strict";

		return Controller.extend("cockpit.credstore.controller.CredentialStore", {
			errorMessages: {},
			onInit: function() {
				this.model = new JSONModel({
					usageTimePeriod: [
						{
							key: Constants.TODAY,
							name: Messages.getText("CredentialStore_UsageSectionToday_XFLD"),
							selected: true,
							enabled: true
						},
						{
							key: Constants.THREE_DAYS,
							name: Messages.getText("CredentialStore_UsageSection3Days_XFLD"),
							selected: false,
							enabled: true
						},
						{
							key: Constants.SEVEN_DAYS,
							name: Messages.getText("CredentialStore_UsageSection7Days_XFLD"),
							selected: false,
							enabled: true
						},
						{
							key: Constants.THIRTYONE_DAYS,
							name: Messages.getText("CredentialStore_UsageSection31Days_XFLD"),
							selected: false,
							enabled: true
						}
					]
				});
				this.model.setProperty("/isFilterApplied", false);
				this.model.setProperty("/sortOrder", Constants.ASCENDING);

				this.getView().setModel(this.model);

				this.subscribeEvent(Constants.PASSWORD);
				this.subscribeEvent(Constants.KEY);
				this.subscribeEvent(Constants.KEYRING);
				this.subscribeEvent(Constants.FILE);
				this.subscribeEvent(Constants.SHARE);
			},

			updateContext: function(context) {
				this.context = context;
				var cfApiInstanceInfoPromise = this.getCfApiInstanceInfo();
				return jQuery.when(cfApiInstanceInfoPromise);
			},

			onExportInstancePressed: function() {
				var oView = this.getView();
				if (!this.exportInstanceView) {
					this.exportInstanceView = new XMLView("exportInstanceView", {
						viewName: "cockpit.credstore.view.ExportInstanceDialog"
					});
					oView.addDependent(this.exportInstanceView);
				}
				var exportInstanceModel = this.exportInstanceView.getModel("exportInstance");
				exportInstanceModel.setProperty("/serviceInstanceId", this.getServiceInstanceId());
				exportInstanceModel.setProperty("/dashboardUrl", this.model.getProperty("/dashboardUrl"));

				this.exportInstanceView.byId("exportInstanceDialog").open();
			},

			onPressRefresh: function() {
				this.context.setBusy(true);
				this.updateContext(this.context).always(
					function() {
						this.context.setBusy(false);
					}.bind(this)
				);
			},

			shouldEnableSharing: function(pendingShares) {
				return pendingShares < 2 && cockpit.credstore.utils.CredstoreUtils.isSpaceDeveloper() === true;
			},

			getServiceInstanceId: function() {
				return this.context.getScope().name;
			},

			getNamespaceName: function(event) {
				return event
					.getSource()
					.getBindingContext()
					.getObject().name;
			},

			getCfApiInstanceInfo: function() {
				var errorType = "cfInstance";
				var controller = this;
				this.context.setBusy(true);
				var serviceInstanceId = this.getServiceInstanceId();
				var cfApiServiceInstanceInfoPromise = CredstoreService.getServiceInstancePromise(serviceInstanceId);

				return cfApiServiceInstanceInfoPromise
					.then(function(data) {
						controller.getInstancePromise(data).always(function() {
							controller.getNamespacesPromise(data);
							controller.getApisUsagePromise(data);
							controller.getProxyInstancesPromise(data);
							controller.getBindingsPromise(data);
						});
						controller.clearErrorMessage(errorType);
						return data;
					})
					.fail(function(jqXHR, textStatus, errorThrown) {
						var backendMessage = BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown);
						controller.getInstancePromise().always(function() {
							controller.getNamespacesPromise();
							controller.getApisUsagePromise();
							controller.getProxyInstancesPromise();
							controller.getBindingsPromise();
						});
						controller.appendErrorMessage(
							Messages.getText("CredentialStore_MessageServiceInstanceError_XMSG", [backendMessage]),
							errorType
						);
					})
					.always(
						function() {
							this.context.setBusy(false);
						}.bind(this)
					);
			},

			//SERVICE INSTANCE INFO SECTION

			getInstancePromise: function(cfApiInstanceInfoPromise) {
				var controller = this;
				var errorType = "instance";
				var serviceInstanceId = this.getServiceInstanceId();
				var dashboardUrl = CredstoreUtils.getDashboardUrl(cfApiInstanceInfoPromise, this.model);
				var instancePromise = CredstoreService.getInstanceInfoPromise(serviceInstanceId, dashboardUrl);

				return instancePromise
					.done(
						function(data) {
							this.model.setProperty("/serviceInstanceInfo", data);
							if (data.serviceInstance.originServiceInstanceId !== undefined) {
								this.model.setProperty("/serviceInstancePlan", Constants.PROXY_PLAN);
							} else {
								this.model.setProperty("/serviceInstancePlan", data.serviceInstance.plan);
							}
							this.model.setProperty(
								"/serviceInstanceAuthType",
								data.serviceInstance.authentication.type
							);
							this.model.setProperty(
								"/serviceInstanceBindingValidity",
								data.serviceInstance.authentication["credentials-validity"]
							);
							this.model.setProperty(
								"/serviceInstancePayloadEncryptionMode",
								data.serviceInstance.payloadEncryption
							);
							this.model.setProperty(
								"/serviceInstancePayloadEncryptionKeySize",
								data.serviceInstance.encryption.key.size
							);
							this.model.setProperty(
								"/serviceInstanceMultiTenancyMode",
								data.serviceInstance.multiTenancy.mode
							);
							this.model.setProperty(
								"/serviceInstanceAccessPolicyCredsApi",
								data.serviceInstance.accessPolicy.creds_api
							);
							this.model.setProperty(
								"/serviceInstanceAccessPolicyTokenApi",
								data.serviceInstance.accessPolicy.token_api
							);
							this.model.setProperty(
								"/serviceInstanceAccessPolicyEncryptionApi",
								data.serviceInstance.accessPolicy.encryption_api
							);
							this.model.setProperty(
								"/serviceInstanceEncryptionKeys",
								data.serviceInstance.cmkSupport[Constants.ENCRYPTION_KEYS]
							);
							this.model.setProperty(
								"/serviceInstanceEncryptionLevel",
								controller.calculateEncryptionLevel(data)
							);

							if (data.serviceInstance.pendingShares > 0) {
								const pendingSharePromise = CredstoreService.getPendingSharesPromise(serviceInstanceId);

								pendingSharePromise
									.then(function(data) {
										controller.handleSharesVisibility(data, controller);
									})
									.fail(function(jqXHR, textStatus, errorThrown) {
										var backendMessage = BackendUtil.constructAjaxErrorMsg(
											jqXHR,
											textStatus,
											errorThrown
										);
										controller.appendErrorMessage(
											Messages.getText("View_ErrorMessageServiceInstancePendingShares_XMSG", [
												backendMessage
											]),
											"serviceInstance"
										);
									});
							} else {
								controller.model.setProperty("/isPendingShare", false);
								controller.model.setProperty("/isPermanentShare", false);
							}
							this.clearErrorMessage(errorType);
						}.bind(this)
					)
					.fail(
						function(jqXHR, textStatus, errorThrown) {
							var backendMessage = BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown);
							var controller = this;
							if (backendMessage.includes(Constants.BACKEND_MESSAGE_FORBIDDEN)) {
								var planBox = this.byId("planVerticalLayout");
								planBox.setBusy(true);
								var servicePlanPromise = this.getServicePlanPromise();

								return servicePlanPromise.then(function() {
									planBox.setBusy(false);
								});
							}
							controller.appendErrorMessage(
								Messages.getText("CredentialStore_MessageServiceInstanceError_XMSG", [backendMessage]),
								errorType
							);
						}.bind(this)
					);
			},

			handleSharesVisibility: function(data, controller) {
				if (data.pendingShares.length === 1 && data.pendingShares[0].permanent === true) {
					controller.model.setProperty("/isPendingShare", false);
					controller.model.setProperty("/isPermanentShare", true);
				} else if (data.pendingShares.length === 1 && data.pendingShares[0].permanent === false) {
					controller.model.setProperty("/isPendingShare", true);
					controller.model.setProperty("/isPermanentShare", false);
				} else {
					controller.model.setProperty("/isPendingShare", true);
					controller.model.setProperty("/isPermanentShare", true);
				}
			},

			getServicePlanPromise: function() {
				var controller = this;
				var serviceInstanceId = this.getServiceInstanceId();

				var serviceInstanceDetailsFromCfApiPromise = CredstoreService.getServiceInstancePromise(
					serviceInstanceId
				);

				return serviceInstanceDetailsFromCfApiPromise
					.then(function(data) {
						var servicePlanPromise = CredstoreService.getServicePlanPromise(
							data.relationships.service_plan.data.guid
						);

						return servicePlanPromise
							.then(function(data) {
								controller
									.getView()
									.getModel()
									.setProperty("/serviceInstancePlan", data.name);
							})
							.fail(function(jqXHR, textStatus, errorThrown) {
								var backendMessage = BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown);
								controller.appendErrorMessage(
									Messages.getText("View_ErrorMessageServiceInstance_XMSG", [backendMessage]),
									"serviceInstance"
								);
							});
					})
					.fail(function(jqXHR, textStatus, errorThrown) {
						var backendMessage = BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown);
						controller.appendErrorMessage(
							Messages.getText("View_ErrorMessageServiceInstance_XMSG", [backendMessage]),
							"serviceInstance"
						);
					});
			},

			//NAMESPACES SECTION

			getNamespacesPromise: function(cfApiInstanceInfoPromise) {
				var serviceInstanceId = this.getServiceInstanceId();

				var isFilterApplied = this.model.getProperty("/isFilterApplied");
				var sortOrder = this.model.getProperty("/sortOrder");
				var dashboardUrl = CredstoreUtils.getDashboardUrl(cfApiInstanceInfoPromise, this.model);
				var namespacesPromise;
				if (isFilterApplied) {
					var filterOperator = this.model.getProperty("/filterOperator");
					var filterValue = encodeURIComponent(this.model.getProperty("/filterValueParameter"));
					namespacesPromise = CredstoreService.getFilteredNamespacesInfoPromise(
						serviceInstanceId,
						sortOrder,
						filterOperator,
						filterValue
					);
				} else {
					namespacesPromise = CredstoreService.getNamespacesInfoPromise(
						serviceInstanceId,
						dashboardUrl,
						sortOrder
					);
				}
				var controller = this;
				var errorType = "namespace";

				return namespacesPromise
					.then(
						function(data) {
							this.model.setProperty("/namespaceTable", data);
							this.model.setProperty("/namespacesCount", data.numberOfElements);
							if (this.model.getProperty("/namespacesCount") > 0) {
								this.model.setProperty("/firstNamespaceName", data.content[0].name);
							}
							controller.clearErrorMessage(errorType);
						}.bind(this)
					)
					.fail(function(jqXHR, textStatus, errorThrown) {
						var backendMessage = BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown);
						controller.appendErrorMessage(
							Messages.getText("CredentialStore_MessageNamespaceError_XMSG", [backendMessage]),
							errorType
						);
					});
			},

			onSortAscNamespacesPressed: function(cfApiInstanceInfoPromise) {
				this.sortNamespaces(cfApiInstanceInfoPromise, Constants.ASCENDING, false, true);
			},

			onSortDescNamespacesPressed: function(cfApiInstanceInfoPromise) {
				this.sortNamespaces(cfApiInstanceInfoPromise, Constants.DESCENDING, true, false);
			},

			sortNamespaces: function(cfApiInstanceInfoPromise, sortOrder, sortAscButtonEnabled, sortDescButtonEnabled) {
				this.model.setProperty("/sortOrder", sortOrder);
				this.byId("sortAsc").setEnabled(sortAscButtonEnabled);
				this.byId("sortDesc").setEnabled(sortDescButtonEnabled);
				this.getNamespacesPromise(cfApiInstanceInfoPromise);

				MessageToast.show(Messages.getText("CredentialStore_MessageNamespaceSorted_XMSG", [sortOrder]));
			},

			onNamespacePressed: function(event) {
				var namespace = this.getNamespaceName(event);
				this.context.navigateToChild(cockpit.common.scopes.CREDSTORE_NAMESPACE, namespace, "credentials");
			},

			onCreateNamespacePressed: function() {
				var oView = this.getView();
				var serviceInstancePlan = this.model.getProperty("/serviceInstancePlan");
				if (!this.createNamespaceView) {
					this.createNamespaceView = new XMLView("createNamespaceView", {
						viewName: "cockpit.credstore.view.CreateNamespaceDialog"
					});
					oView.addDependent(this.createNamespaceView);
				}

				var createNamespaceModel = this.createNamespaceView.getModel("newNamespace");
				createNamespaceModel.setProperty("/serviceInstancePlan", serviceInstancePlan);
				createNamespaceModel.setProperty("/serviceInstanceId", this.getServiceInstanceId());
				createNamespaceModel.setProperty("/view", Constants.CREDENTIAL_STORE_VIEW);

				createNamespaceModel.setProperty("/dashboardUrl", this.model.getProperty("/dashboardUrl"));
				createNamespaceModel.setProperty("/isRestrictedPlan", this.isRestrictedPlan(serviceInstancePlan));
				this.isFileOptionVisible(createNamespaceModel);
				this.createNamespaceView.byId("createNamespaceDialog").open();
			},

			onDeleteCredentialsFromNspPressed: function(event) {
				var namespace = this.getNamespaceName(event);
				var controller = this;
				MessageBox.confirm(Messages.getText("CredentialStore_DeletePrompt_XMSG", [namespace]), {
					styleClass: "sapUiSizeCompact",
					onClose: function(confirmed) {
						if (confirmed === MessageBox.Action.OK) {
							controller.deleteAllCredentialsFromNamespace(namespace);
						}
					},
					title: Messages.getText("CredentialStore_DeletePrompt_XGRP"),
					initialFocus: MessageBox.Action.CANCEL
				});
			},

			deleteAllCredentialsFromNamespace: function(namespaceName) {
				var serviceInstanceId = this.getServiceInstanceId();
				var dashboardUrl = this.model.getProperty("/dashboardUrl");

				var deleteAllCredentialsPromise = CredstoreService.deleteAllCredentialsPromise(
					serviceInstanceId,
					namespaceName,
					dashboardUrl
				);

				this.context.setBusy(true);
				deleteAllCredentialsPromise
					.then(
						function() {
							this.getInstancePromise();
							this.getNamespacesPromise();
							MessageToast.show(
								Messages.getText("CredentialStore_DeleteCredentials_XMSG", [namespaceName])
							);
						}.bind(this)
					)
					.fail(function(jqXHR, textStatus, errorThrown) {
						MessageBox.error(
							Messages.getText("CredentialStore_ErrorDeleteCredentials_XMSG", [
								BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown)
							]),
							{
								styleClass: "sapUiSizeCompact",
								title: Messages.getText("CredentialStore_Error_XTIT")
							}
						);
					})
					.always(
						function() {
							this.context.setBusy(false);
						}.bind(this)
					);
			},

			onSearch: function() {
				if (this.byId("go").getEnabled() === true) {
					this.model.setProperty("/isFilterApplied", true);
					this.filterNamespaces();
				}
			},

			onClear: function() {
				var filterInput = this.byId("nameFilterInput");
				var isFilterApplied = this.model.getProperty("/isFilterApplied");

				if (!!filterInput.getValue()) {
					filterInput.setValue("");
					filterInput.fireLiveChange({
						value: ""
					});
				}

				if (isFilterApplied) {
					this.model.setProperty("/isFilterApplied", false);
					this.filterNamespaces();
				}
			},

			filterNamespaces: function() {
				var filterValue = this.byId("nameFilterInput").getValue();
				CredstoreUtils.applyFilterOperator(filterValue, this.model);
				this.context.setBusy(true);
				this.getNamespacesPromise().always(
					function() {
						this.context.setBusy(false);
					}.bind(this)
				);
			},

			filterValueChange: function() {
				var value = this.model.getProperty("/filterValue");
				this.validateFilterValue(value);
			},

			validateFilterValue: function(value) {
				var regexEndsWith = /^\*[\w-:~!.]{1,}$/;
				var regexStartsWith = /^[\w-:~!.]{1,}\*$/;
				var regexNotContains = /^\![\w-:~.]{1,}$/;
				var regexEquals = /^\"[\w-:~!.]{1,}\"$/;
				var regexNotEquals = /^\!\"[\w-:~!.]{1,}\"$/;
				var regexContains = /^[\w-:~.]{1,}$/;

				if (
					value !== "" &&
					!regexStartsWith.test(value) &&
					!regexEndsWith.test(value) &&
					!regexNotContains.test(value) &&
					!regexEquals.test(value) &&
					!regexNotEquals.test(value) &&
					!regexContains.test(value)
				) {
					this.model.setProperty("/validationError", "error");
					return;
				} else {
					this.model.setProperty("/validationError", undefined);
				}
			},

			goEnabled: function(filterValue, validationError) {
				return !!filterValue && !validationError;
			},

			onFilterInfoPressed: function() {
				MessageBox.information(Messages.getText("Filter_NamespacesInformation_XMSG"));
			},

			//USAGE STATISTICS SECTION

			getApisUsagePromise: function(cfApiInstanceInfoPromise) {
				if (this.isProxyPlan()) {
					return;
				}
				var errorType = "serviceInstanceUsage";
				var controller = this;
				var serviceInstanceId = this.getServiceInstanceId();

				var dashboardUrl = CredstoreUtils.getDashboardUrl(cfApiInstanceInfoPromise, this.model);
				var timePeriod =
					this.model.getProperty("/selectedTimePeriodKey") === undefined
						? "today"
						: this.model.getProperty("/selectedTimePeriodKey");

				return CredstoreService.getUsagePromise(serviceInstanceId, timePeriod, dashboardUrl)
					.done(
						function(data) {
							this.onApiTypeSelected();
							var dataDailyUsage = data.dailyUsage;
							this.model.setProperty("/usageData", data);
							this.model.setProperty("/usageDataContent", dataDailyUsage.content.reverse());
							controller.clearErrorMessage(errorType);
						}.bind(this)
					)
					.fail(function(jqXHR, textStatus, errorThrown) {
						var backendMessage = BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown);
						if (backendMessage.includes(Constants.BACKEND_MESSAGE_FORBIDDEN)) {
							return;
						} else {
							controller.appendErrorMessage(
								Messages.getText("View_ErrorMessageServiceInstanceUsage_XMSG", [backendMessage]),
								errorType
							);
						}
					});
			},

			onApiTypeSelected: function() {
				this.oVizFrame = this.getView().byId("idVizFrame");
				var feedValueAxis = this.getView().byId("valueAxisFeed");
				var selectedApis = [];
				var apiTypesDict = {
					admin: Messages.getText("CredentialStore_UsageSectionAdminApi_XFLD"),
					broker: Messages.getText("CredentialStore_UsageSectionBrokerApi_XFLD"),
					creds: Messages.getText("CredentialStore_UsageSectionCredsApi_XFLD"),
					kms: Messages.getText("CredentialStore_UsageSectionEncryptionApi_XFLD"),
					token: Messages.getText("CredentialStore_UsageSectionTokenApi_XFLD")
				};
				if (this.oVizFrame) {
					for (var key in apiTypesDict) {
						if (this.isApiTypeSelected(key)) {
							selectedApis.push(apiTypesDict[key]);
						}
					}
					feedValueAxis.setValues(selectedApis);
					this.oVizFrame.addFeed(feedValueAxis);
				}
			},

			isApiTypeSelected: function(apiType) {
				return this.getView()
					.byId(apiType)
					.getSelected();
			},

			onDownloadUsageAsJson: function() {
				var serviceInstanceId = this.getServiceInstanceId();
				var filename = serviceInstanceId + "-usage.json";
				DataExport.downloadJson(this.model.getProperty("/usageData"), filename);
			},

			selectTimePeriod: function(oEvent) {
				var source = oEvent.getSource();

				if (oEvent.getParameters().selected) {
					var selectedObject = source.getBindingContext().getObject();
					var timePeriod = selectedObject.key;
					this.model.setProperty("/selectedTimePeriodKey", timePeriod);
					this.getApisUsagePromise();
				}
			},

			//SERVICE SHARING SECTION

			getProxyInstancesPromise: function(cfApiInstanceInfoPromise) {
				if (this.isProxyPlan()) {
					return;
				}
				var serviceInstanceId = this.getServiceInstanceId();
				var dashboardUrl = CredstoreUtils.getDashboardUrl(cfApiInstanceInfoPromise, this.model);
				var proxyInstancesPromise = CredstoreService.getProxyInstancesInfoPromise(
					serviceInstanceId,
					dashboardUrl
				);
				var errorType = "proxyInstances";
				var controller = this;

				return proxyInstancesPromise
					.then(
						function(data) {
							this.model.setProperty("/proxyInstancesTable", data);
							controller.clearErrorMessage(errorType);
						}.bind(this)
					)
					.fail(function(jqXHR, textStatus, errorThrown) {
						var backendMessage = BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown);
						if (backendMessage.includes(Constants.BACKEND_MESSAGE_FORBIDDEN)) {
							return;
						} else {
							controller.appendErrorMessage(
								Messages.getText("CredentialStore_MessageProxyInstancesError_XMSG", [backendMessage]),
								errorType
							);
						}
					});
			},

			onProxyInstancesInfoPressed: function() {
				MessageBox.information(Messages.getText("CredentialStore_SharingSectionInfo_XMSG"));
			},

			onShareInfoPressed: function() {
				MessageBox.information(Messages.getText("CredentialStore_ShareInstanceInfo_XMSG"));
			},

			onUnsharePressed: function(event) {
				var controller = this;
				var proxyInstance = event
					.getSource()
					.getBindingContext()
					.getObject();
				MessageBox.confirm(Messages.getText("CredentialStore_UnsharePrompt_XMSG"), {
					styleClass: "sapUiSizeCompact",
					onClose: function(confirmed) {
						if (confirmed === MessageBox.Action.OK) {
							controller.unshareProxyInstance(proxyInstance);
						}
					},
					title: Messages.getText("CredentialStore_UnsharePrompt_XGRP"),
					initialFocus: MessageBox.Action.CANCEL
				});
			},

			unshareProxyInstance: function(proxyInstance) {
				var controller = this;
				var view = this.getView();
				view.setBusy(true);

				var params = {
					parameters: {
						unshare: {
							landscape: proxyInstance.landscape,
							proxyServiceGuid: proxyInstance.serviceInstanceId
						}
					}
				};

				var updateServiceInstancePromise = CredstoreService.updateServiceInstancePromise(
					controller.getServiceInstanceId(),
					params,
					Constants.UNSHARE
				);

				return updateServiceInstancePromise
					.then(function(data) {
						if (data.state === Constants.COMPLETE_STATE) {
							MessageToast.show(Messages.getText("CredentialStore_UnshareSuccess_YMSG"));
							controller.getInstancePromise();
							controller.getProxyInstancesPromise();
						} else if (data.state === Constants.FAILED_STATE) {
							var error = data.errors[0].detail;
							MessageBox.error(Messages.getText("CredentialStore_UnshareError_YMSG"), {
								details: error,
								title: Messages.getText("CredentialStore_UnshareError_XTIT")
							});
						} else {
							MessageToast.show(Messages.getText("CredentialStore_UnshareInProgress_YMSG"));
						}
					})
					.fail(function() {
						MessageToast.show(Messages.getText("CredentialStore_UnshareError_YMSG"));
					})
					.always(function() {
						view.setBusy(false);
					});
			},

			onPressShareInstance: function() {
				var oView = this.getView();

				if (!this.serviceSharingDialogView) {
					this.serviceSharingDialogView = new XMLView("serviceSharingDialogView", {
						viewName: "cockpit.credstore.view.ShareInstanceDialog"
					});
					oView.addDependent(this.serviceSharingDialogView);
				}
				this.serviceSharingDialogView
					.getModel("shareInstance")
					.setProperty("/view", Constants.CREDENTIAL_STORE_VIEW);
				this.serviceSharingDialogView
					.getModel("shareInstance")
					.setProperty("/serviceInstanceId", this.getServiceInstanceId());
				this.serviceSharingDialogView.byId("shareInstanceDialog").open();
			},

			onPendingSharePressed: function() {
				this.onPendingOrPermanentSharePressed(false);
			},

			onPermanentSharePressed: function() {
				this.onPendingOrPermanentSharePressed(true);
			},

			onPendingOrPermanentSharePressed: function(permanent) {
				var view = this.getView();
				var controller = this;
				var serviceInstanceId = controller.getServiceInstanceId();

				if (!this.pendingShareDialogView) {
					this.pendingShareDialogView = new XMLView("pendingShareDialogView", {
						viewName: "cockpit.credstore.view.PendingShareDialog"
					});
					view.addDependent(this.pendingShareDialogView);
				}

				// var pendingSharePromise = CredstoreService.getPendingSharesPromise(serviceInstanceId);

				return pendingSharePromise
					.then(function(data) {
						controller.loadShareData(controller, data, serviceInstanceId, permanent);
					})
					.fail(function(jqXHR, textStatus, errorThrown) {
						MessageBox.error(
							Messages.getText("PendingShare_ErrorGetPendingShareDetails_XMSG", [
								BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown)
							]),
							{
								styleClass: "sapUiSizeCompact",
								title: Messages.getText("CredentialStore_Error_XTIT")
							}
						);
					});
			},

			loadShareData: function(controller, data, serviceInstanceId, permanent) {
				if (data.pendingShares.length !== 0) {
					var pendingShareModel = controller.pendingShareDialogView.getModel("pendingShareModel");
					var pendingShares = data.pendingShares;

					var pendingShare;
					if (pendingShares.length === 1) {
						pendingShare = pendingShares[0];
					} else {
						if (pendingShares[0].permanent === permanent) {
							pendingShare = pendingShares[0];
						} else {
							pendingShare = pendingShares[1];
						}
					}
					var landscape;
					if (pendingShare.originLandscape !== pendingShare.landscape) {
						landscape = pendingShare.originLandscape;
					} else {
						landscape = null;
					}

					pendingShareModel.setProperty("/view", Constants.CREDENTIAL_STORE_VIEW);
					pendingShareModel.setProperty("/serviceInstanceId", controller.getServiceInstanceId());
					pendingShareModel.setProperty("/pendingShare", pendingShare);
					pendingShareModel.setProperty(
						"/cliCommand",
						CredstoreUtils.constructPendingShareCliCommand(landscape, serviceInstanceId)
					);
					pendingShareModel.setProperty(
						"/instanceParameters",
						CredstoreUtils.constructPendingShareInstanceParameters(landscape, serviceInstanceId)
					);

					if (permanent === true) {
						controller.pendingShareDialogView
							.byId("pendingShareDialog")
							.setTitle(Messages.getText("PermanentShare_Dialog_XTIT"));
					} else {
						controller.pendingShareDialogView
							.byId("pendingShareDialog")
							.setTitle(Messages.getText("PendingShare_Dialog_XTIT"));
					}
					controller.pendingShareDialogView.byId("pendingShareDialog").open();
				} else {
					MessageBox.information(Messages.getText("PendingShare_ExpiredOrConsumed_XMSG"), {
						onClose: function() {
							controller.onPressRefresh();
						}
					});
				}
			},

			onProxyInstanceDetailsPressed: function(event) {
				var errorType = "proxyInstanceDetails";
				var oView = this.getView();
				var servinceInstanceId = this.getServiceInstanceId();
				var dashboardUrl = this.model.getProperty("/dashboardUrl");
				var proxyInstanceId = event
					.getSource()
					.getBindingContext()
					.getObject().serviceInstanceId;

				if (!this.proxyDetailsDialogView) {
					this.proxyDetailsDialogView = new XMLView("proxyDetailsDialogView", {
						viewName: "cockpit.credstore.view.ProxyInstanceDetailsDialog"
					});
					oView.addDependent(this.proxyDetailsDialogView);
				}
				var controller = this;
				var proxyInstanceDetailsPromise = CredstoreService.getProxyInstanceDetailsPromise(
					servinceInstanceId,
					proxyInstanceId,
					dashboardUrl
				);
				return proxyInstanceDetailsPromise
					.then(function(data) {
						controller.proxyDetailsDialogView.getModel("proxyDetails").setProperty("/details", data);
						controller.proxyDetailsDialogView
							.getModel("proxyDetails")
							.setProperty("/details/authorizations", JSON.stringify(data.authorization, null, "\t"));
						controller.proxyDetailsDialogView.byId("proxyDetailsDialog").open();
						controller.clearErrorMessage(errorType);
					})
					.fail(function(jqXHR, textStatus, errorThrown) {
						var backendMessage = BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown);
						controller.appendErrorMessage(
							Messages.getText("DetailsDialog_ErrorMessageProxyDetails_XMSG", [backendMessage], errorType)
						);
					});
			},

			//BINDINGS SECTION

			setBindingData: function(data, controller, filterByName) {
				var bindings = data.content;
				this.model.setProperty("/bindingsTotalPagesCount", data.totalPages);

				this.formatBindingExpirationDate(bindings);
				if (this.isProxyPlan()) {
					this.model.setProperty(
						"/serviceInstanceInfo/serviceInstance/usedQuota/bindings",
						data.numberOfElements
					);
				}
				controller.clearErrorMessage(Constants.BINDINGS_ERROR_TYPE);

				var getSpaceServiceInstancesPromise = HttpUtil.executeUrl(this.getSpaceServiceInstancesUrl(), "GET");

				return getSpaceServiceInstancesPromise
					.then(
						function(data) {
							this.addBindingNamesAndTypes(data, controller, bindings, filterByName);
							this.model.setProperty("/bindingsTable", bindings);
						}.bind(this)
					)
					.fail(function(jqXHR, textStatus, errorThrown) {
						var backendMessage = BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown);
						controller.appendErrorMessage(
							Messages.getText("CredentialStore_MessageBindingsError_XMSG", [backendMessage]),
							Constants.BINDINGS_ERROR_TYPE
						);
					});
			},

			addBindingNamesAndTypes: function(data, controller, bindings, filterByNameFlag) {
				var type = this.byId("bindingTypeSelect").getSelectedKey();
				var searchInputValue = this.byId("bindingFilterInput").getValue();

				var currentInstance = data.cloudfoundry.filter(
					instance => instance.id === controller.getServiceInstanceId()
				);
				var apps = currentInstance[0].applications;
				var serviceKeys = currentInstance[0].serviceKeys;

				apps.forEach(app => {
					bindings.forEach(binding => {
						if (binding.applicationId === app.guid) {
							binding.applicationName = app.name;
							binding.type = Constants.APPLICATION_BINDING_TYPE;
						}
					});
				});

				serviceKeys.forEach(key => {
					bindings.forEach(binding => {
						if (binding.id === key.guid) {
							binding.applicationName = key.name;
							binding.type = Constants.SERVICE_KEY_BINDING_TYPE;
						}
					});
				});

				this.filterByAppName(searchInputValue, filterByNameFlag, apps, bindings, serviceKeys);

				this.filterByType(type, serviceKeys, bindings, apps);

				this.model.setProperty("/bindingsCount", bindings.length);
			},

			getSpaceServiceInstancesUrl: function() {
				var spaceScope = this.context
					.getScope()
					.getParent()
					.getParent();
				var spaceId = spaceScope.getObjectInformation().guid;
				var tenantId = spaceScope.getParent().getObjectInformation().guid;
				var subaccountInfo = spaceScope
					.getParent()
					.getParent()
					.getObjectInformation();
				var dataCenter = subaccountInfo.dataCenter;
				var landscapeLabel = dataCenter.name;
				var subaccountId = subaccountInfo.subaccountId;
				var globalAccountId = subaccountInfo.globalAccountId;
				var platformId = subaccountInfo.subaccountDataFromParent.platformId;

				return `/ajax/${globalAccountId}/${landscapeLabel}/${subaccountId}/GetInstances?type=cockpit.common.scopes.CFSpace&org-guid=${platformId}&tenant-id=${tenantId}&landscapeLabel=${landscapeLabel}&subaccount-id=${subaccountId}&global-id=${globalAccountId}&space-guid=${spaceId}`;
			},

			formatBindingExpirationDate: function(bindings) {
				$.each(bindings, function(index, binding) {
					if (binding.expiresAt !== undefined) {
						var date = new Date(binding.expiresAt);
						bindings[index].expiresAt = cockpit.common.UiUtils.formatDateTime(date);
					}
				});
			},

			setFilterBindingError: function(jqXHR, textStatus, errorThrown) {
				MessageBox.error(
					Messages.getText("CredentialStore_BindingFilterError_XMSG", [
						BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown)
					]),
					{
						styleClass: "sapUiSizeCompact",
						title: Messages.getText("CredentialStore_Error_XTIT")
					}
				);
			},

			getBindingsPromise: function(cfApiInstanceInfoPromise) {
				var serviceInstanceId = this.getServiceInstanceId();
				var dashboardUrl = CredstoreUtils.getDashboardUrl(cfApiInstanceInfoPromise, this.model);
				var bindingsPromise = CredstoreService.getBindingsPromise(serviceInstanceId, dashboardUrl);
				var controller = this;
				return bindingsPromise
					.done(
						function(data) {
							this.setBindingData(data, controller, false);
						}.bind(this)
					)
					.fail(function(jqXHR, textStatus, errorThrown) {
						var backendMessage = BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown);
						if (backendMessage.includes(Constants.BACKEND_MESSAGE_FORBIDDEN)) {
							return;
						} else {
							controller.appendErrorMessage(
								Messages.getText("CredentialStore_MessageBindingsError_XMSG", [backendMessage]),
								Constants.BINDINGS_ERROR_TYPE
							);
						}
					});
			},

			onBindingPressed: function(event) {
				var errorType = "bindingDetails";
				var oView = this.getView();
				var servinceInstanceId = this.getServiceInstanceId();
				var dashboardUrl = this.model.getProperty("/dashboardUrl");

				var bindingId = event
					.getSource()
					.getBindingContext()
					.getObject().id;

				if (!this.bindingDetailsDialogView) {
					this.bindingDetailsDialogView = new XMLView("bindingDetailsDialogView", {
						viewName: "cockpit.credstore.view.BindingDetailsDialog"
					});
					oView.addDependent(this.bindingDetailsDialogView);
				}
				var controller = this;
				var bindingDetailsPromise = CredstoreService.getBindingDetailsPromise(
					servinceInstanceId,
					bindingId,
					dashboardUrl
				);

				return bindingDetailsPromise
					.then(function(data) {
						controller.bindingDetailsDialogView
							.getModel("bindingDetails")
							.setProperty("/context", controller.context);
						controller.bindingDetailsDialogView.getModel("bindingDetails").setProperty("/details", data);
						controller.bindingDetailsDialogView
							.getModel("bindingDetails")
							.setProperty("/json", JSON.stringify(data, null, "\t"));
						controller.bindingDetailsDialogView
							.getModel("bindingDetails")
							.setProperty("/authorization", JSON.stringify(data.authorization, null, "\t"));
						controller.bindingDetailsDialogView.byId("bindingDetailsDialog").open();
						controller.clearErrorMessage(errorType);
					})
					.fail(function(jqXHR, textStatus, errorThrown) {
						var backendMessage = BackendUtil.constructAjaxErrorMsg(jqXHR, textStatus, errorThrown);
						controller.appendErrorMessage(
							Messages.getText("BindingDetailsDialog_ErrorMessage_XMSG", [backendMessage], errorType)
						);
					});
			},

			onBindingsMultiSelectButtonPressed: function(oEvent) {
				var disableBindingsButton = this.getView().byId("disableBindingsButton");
				var enableBindingsButton = this.getView().byId("enableBindingsButton");

				if (oEvent.getSource().getPressed()) {
					disableBindingsButton.setVisible(true);
					enableBindingsButton.setVisible(true);
					this.model.setProperty("/bindingsTableSelectionMode", "MultiSelect");
				} else {
					disableBindingsButton.setVisible(false);
					enableBindingsButton.setVisible(false);
					this.model.setProperty("/bindingsTableSelectionMode", "None");
				}
			},

			onRowSelectionChange: function(oEvent) {
				var disableBindingsButton = this.getView().byId("disableBindingsButton");
				var enableBindingsButton = this.getView().byId("enableBindingsButton");

				if (
					oEvent.getSource().getSelectedItems().length > 0 &&
					cockpit.credstore.utils.CredstoreUtils.isSpaceDeveloper()
				) {
					disableBindingsButton.setEnabled(true);
					enableBindingsButton.setEnabled(true);
				} else {
					disableBindingsButton.setEnabled(false);
					enableBindingsButton.setEnabled(false);
				}
			},

			onEnableBindings: function() {
				this.patchBindings(Constants.ENABLED);
			},

			onDisableBindings: function() {
				this.patchBindings(Constants.DISABLED);
			},

			onBindingFilterChange: function() {
				var serviceInstanceId = this.getServiceInstanceId();
				var dashboardUrl = this.model.getProperty("/dashboardUrl");
				var searchInputValue = this.byId("bindingFilterInput").getValue();
				var filters;
				var filterValues;
				var isName = false;
				if (!CredstoreUtils.isBindingSearchInputEmpty(searchInputValue)) {
					this.byId("bindingStatusSelect").setSelectedKey(Constants.BINDINGS_ALL_STATUSES_OPTION);
					this.byId("bindingAuthTypeSelect").setSelectedKey(
						Constants.BINDINGS_ALL_AUTHENTICATION_TYPES_OPTION
					);
					this.byId("bindingPeSelect").setSelectedKey(Constants.BINDINGS_ALL_PE_OPTIONS_OPTION);
					this.byId("bindingTypeSelect").setSelectedKey(Constants.BINDINGS_ALL_TYPES_OPTION);

					if (!Constants.REGEX_BINDING_FILTER_BY_NAME.test(searchInputValue)) {
						filters = [];
						filterValues = [];
						isName = true;
					} else {
						filters = ["id"];
						filterValues = [searchInputValue];
					}
				} else {
					var selectedStatusFilterValue = this.byId("bindingStatusSelect").getSelectedKey();
					var selectedAuthenticationFilterValue = this.byId("bindingAuthTypeSelect").getSelectedKey();
					var selectedPeFilterValue = this.byId("bindingPeSelect").getSelectedKey();
					filters = ["status", "authentication", "payloadEncryption"];
					filterValues = [
						selectedStatusFilterValue,
						selectedAuthenticationFilterValue,
						selectedPeFilterValue
					];
				}
				var view = this.getView();
				view.setBusy(true);
				CredstoreUtils.applyBindingEqFilter(this.model, filters, filterValues);
				var filterValue = encodeURIComponent(this.model.getProperty(Constants.BINDING_FILTER_VALUE));
				var filteredBindingsPromise = CredstoreService.getFilteredBindingsPromise(
					serviceInstanceId,
					filterValue,
					dashboardUrl
				);

				var controller = this;

				return filteredBindingsPromise
					.then(
						function(data) {
							if (
								data.numberOfElements === 0 &&
								!CredstoreUtils.isBindingSearchInputEmpty(searchInputValue) &&
								isName === false
							) {
								view.setBusy(true);
								filters.pop();
								filters.push("applicationId");
								CredstoreUtils.applyBindingEqFilter(this.model, filters, filterValues);

								var newFilterValue = encodeURIComponent(
									this.model.getProperty(Constants.BINDING_FILTER_VALUE)
								);

								return CredstoreService.getFilteredBindingsPromise(
									serviceInstanceId,
									newFilterValue,
									dashboardUrl
								)
									.then(
										function(newData) {
											if (
												newData.numberOfElements === 0 &&
												!CredstoreUtils.isBindingSearchInputEmpty(searchInputValue)
											) {
												view.setBusy(true);
												filters.pop();
												CredstoreUtils.applyBindingEqFilter(this.model, filters, filterValues);
												var thirdFilterValue = encodeURIComponent(
													this.model.getProperty(Constants.BINDING_FILTER_VALUE)
												);
												return CredstoreService.getFilteredBindingsPromise(
													serviceInstanceId,
													thirdFilterValue,
													dashboardUrl
												)
													.then(
														function(thirdData) {
															this.setBindingData(thirdData, controller, true);
														}.bind(this)
													)
													.fail(
														function(jqXHR, textStatus, errorThrown) {
															this.setFilterBindingError(jqXHR, textStatus, errorThrown);
														}.bind(this)
													)
													.always(function() {
														view.setBusy(false);
													});
											}
											this.setBindingData(newData, controller, isName);
										}.bind(this)
									)
									.fail(
										function(jqXHR, textStatus, errorThrown) {
											this.setFilterBindingError(jqXHR, textStatus, errorThrown);
										}.bind(this)
									)
									.always(function() {
										view.setBusy(false);
									});
							}
							this.setBindingData(data, controller, isName);
						}.bind(this)
					)
					.fail(
						function(jqXHR, textStatus, errorThrown) {
							this.setFilterBindingError(jqXHR, textStatus, errorThrown);
						}.bind(this)
					)
					.always(function() {
						view.setBusy(false);
					});
			},

			patchBindings: function(status) {
				var view = this.getView();
				view.setBusy(true);

				var serviceInstanceId = this.getServiceInstanceId();
				var bindings = view.byId("bindingsTable").getSelectedItems();

				if (bindings < 1) {
					view.setBusy(false);
					return;
				}

				var parameters = {
					bindingIds: [],
					status: status
				};

				for (var element of bindings) {
					parameters.bindingIds.push(element.getBindingContext().getObject().id);
				}

				var patchBindingsPromise = CredstoreService.patchBindingsPromise(serviceInstanceId, parameters);
				var controller = this;

				return patchBindingsPromise
					.then(function(data) {
						var unsuccessfullyUpdatedBindings = data.unsuccessfullyUpdatedBindings.length;
						var successfullyUpdatedBindings = data.successfullyUpdatedBindings.length;
						var totalBindings = data.totalBindings;
						if (successfullyUpdatedBindings === totalBindings) {
							controller.onBindingFilterChange();
							MessageToast.show(
								Messages.getText("CredentialStore_MessageBindingsSuccessfullyUpdated_XMSG")
							);
						} else if (unsuccessfullyUpdatedBindings === totalBindings) {
							controller.onBindingFilterChange();
							MessageToast.show(Messages.getText("CredentialStore_MessageBindingsUpdateFailed_XMSG"));
						} else {
							controller.onBindingFilterChange();
							var unsuccessfullyUpdatedBindingsList = data.unsuccessfullyUpdatedBindings.join(", ");
							MessageBox.warning(
								Messages.getText("CredentialStore_MessageBindingsUpdatedWithPartialSuccess_XMSG", [
									unsuccessfullyUpdatedBindingsList
								]),
								{
									title: Messages.getText(
										"CredentialStore_MessageBindingsUpdatedWithPartialSuccess_XTIT"
									)
								}
							);
						}
					})
					.fail(function() {
						MessageToast.show(Messages.getText("CredentialStore_MessageBindingsUpdateFailed_XMSG"));
					})
					.always(function() {
						view.byId("bindingsTable").removeSelections(true);
						view.setBusy(false);
					});
			},

			//SETTINGS SECTION

			calculateEncryptionLevel: function(data) {
				var encryptionKeys = data.serviceInstance.cmkSupport[Constants.ENCRYPTION_KEYS];
				var encryptionLevel = data.serviceInstance.cmkSupport.level;
				var multiTenancyMode = data.serviceInstance.multiTenancy.mode;

				if (encryptionLevel !== Constants.CREDENTIAL_ENCRYPTION_LEVEL) {
					if (
						encryptionKeys === Constants.SAP_ENCRYPTION_KEYS ||
						(encryptionKeys !== Constants.SAP_ENCRYPTION_KEYS &&
							multiTenancyMode === Constants.APPLICATION_MULTI_TENANCY_MODE)
					) {
						encryptionLevel = Constants.INSTANCE_ENCRYPTION_LEVEL;
					} else if (multiTenancyMode !== Constants.APPLICATION_MULTI_TENANCY_MODE) {
						encryptionLevel = Constants.NAMESPACE_ENCRYPTION_LEVEL;
					}
				}

				return encryptionLevel;
			},

			onPressSaveConfiguration: function() {
				var view = this.getView();
				view.setBusy(true);

				var edit = this.byId("editSubSection");
				edit.setVisible(false);
				var info = this.byId("infoSubSection");
				info.setVisible(true);

				var serviceInstanceId = this.getServiceInstanceId();
				var configParams = this.getChangedConfigParameters();
				if (CredstoreUtils.isEmptyObject(configParams["parameters"])) {
					view.setBusy(false);
					return;
				}
				var controller = this;
				var updateServiceInstancePromise = CredstoreService.updateServiceInstancePromise(
					serviceInstanceId,
					configParams,
					Constants.UPDATE
				);

				return updateServiceInstancePromise
					.then(function(data) {
						if (data.state === Constants.COMPLETE_STATE) {
							MessageToast.show(Messages.getText("CredentialStore_ConfigurationUpdateSuccess_YMSG"));
							controller.getInstancePromise();
						} else if (data.state === Constants.FAILED_STATE) {
							var error = data.errors[0].detail;
							MessageBox.error(Messages.getText("CredentialStore_ConfigurationUpdateError_YMSG"), {
								details: error,
								title: Messages.getText("CredentialStore_ConfigurationUpdateError_XTIT")
							});
						} else {
							MessageToast.show(Messages.getText("CredentialStore_ConfigurationUpdateInProgress_YMSG"));
						}
					})
					.fail(function() {
						MessageToast.show(Messages.getText("CredentialStore_ConfigurationUpdateError_YMSG"));
					})
					.always(function() {
						view.setBusy(false);
					});
			},

			getChangedConfigParameters: function() {
				var config = {
					parameters: {}
				};

				if (this.model.getProperty("/serviceInstanceAuthType") !== this.byId("authSelect").getSelectedKey()) {
					var authParameter = {
						authentication: {
							type: this.byId("authSelect").getSelectedKey()
						}
					};
					$.extend(config["parameters"], authParameter);
				}

				if (
					parseInt(this.model.getProperty("/serviceInstanceBindingValidity")) !==
					parseInt(this.model.getProperty("/bindingValidity"))
				) {
					var bindingValidityParameter = {
						authentication: {
							"credentials-validity": parseInt(this.model.getProperty("/bindingValidity"))
						}
					};
					$.extend(config["parameters"], bindingValidityParameter);
				}

				if (
					this.model.getProperty("/serviceInstancePayloadEncryptionMode") !==
						this.byId("payloadEncryptionSelect").getSelectedKey() ||
					this.model.getProperty("/serviceInstancePayloadEncryptionKeySize") !==
						this.byId("payloadEncryptionKeySizeSelect").getSelectedKey()
				) {
					var encryptionParameter = {
						encryption: {
							payload: this.byId("payloadEncryptionSelect").getSelectedKey(),
							key: {
								size: this.byId("payloadEncryptionKeySizeSelect").getSelectedKey()
							}
						}
					};
					$.extend(config["parameters"], encryptionParameter);
				}

				if (
					this.model.getProperty("/serviceInstanceAccessPolicyCredsApi") !==
						this.byId("credsApiSelect").getSelectedKey() ||
					this.model.getProperty("/serviceInstanceAccessPolicyTokenApi") !==
						this.byId("tokenApiSelect").getSelectedKey() ||
					this.model.getProperty("/serviceInstanceAccessPolicyEncryptionApi") !==
						this.byId("encryptionApiSelect").getSelectedKey()
				) {
					var accessPolicyParameter = {
						access_policy: {
							creds_api: this.byId("credsApiSelect").getSelectedKey(),
							token_api: this.byId("tokenApiSelect").getSelectedKey(),
							encryption_api: this.byId("encryptionApiSelect").getSelectedKey()
						}
					};
					$.extend(config["parameters"], accessPolicyParameter);
				}

				if (
					this.model.getProperty("/serviceInstanceMultiTenancyMode") !==
					this.byId("multiTenancyModeSelect").getSelectedKey()
				) {
					var multiTenancyParameter = {
						"multi-tenancy": {
							mode: this.byId("multiTenancyModeSelect").getSelectedKey()
						}
					};
					$.extend(config["parameters"], multiTenancyParameter);
				}

				if (
					this.model.getProperty("/serviceInstanceEncryptionKeys") !==
						this.byId("encryptionKeysSelect").getSelectedKey() ||
					this.model.getProperty("/serviceInstanceEncryptionLevel") !==
						this.byId("encryptionLevelSelect").getSelectedKey()
				) {
					var cmkSupportParameter;
					if (this.byId("encryptionLevelSelect").getSelectedKey() === Constants.CREDENTIAL_ENCRYPTION_LEVEL) {
						cmkSupportParameter = {
							"cmk-support": {
								"encryption-keys": this.byId("encryptionKeysSelect").getSelectedKey(),
								level: Constants.CREDENTIAL_ENCRYPTION_LEVEL
							}
						};
					} else {
						cmkSupportParameter = {
							"cmk-support": {
								"encryption-keys": this.byId("encryptionKeysSelect").getSelectedKey()
							}
						};
					}
					$.extend(config["parameters"], cmkSupportParameter);
				}

				return config;
			},

			onPressEditConfiguration: function() {
				var edit = this.byId("editSubSection");
				edit.setVisible(true);

				var info = this.byId("infoSubSection");
				info.setVisible(false);

				this.byId("authSelect").setSelectedKey(this.model.getProperty("/serviceInstanceAuthType"));
				this.byId("editBindingValidityInput").setValue(
					this.model.getProperty("/serviceInstanceBindingValidity")
				);
				this.byId("payloadEncryptionSelect").setSelectedKey(
					this.model.getProperty("/serviceInstancePayloadEncryptionMode")
				);
				this.byId("payloadEncryptionKeySizeSelect").setSelectedKey(
					this.model.getProperty("/serviceInstancePayloadEncryptionKeySize")
				);
				this.byId("credsApiSelect").setSelectedKey(
					this.model.getProperty("/serviceInstanceAccessPolicyCredsApi")
				);
				this.byId("tokenApiSelect").setSelectedKey(
					this.model.getProperty("/serviceInstanceAccessPolicyTokenApi")
				);
				this.byId("encryptionApiSelect").setSelectedKey(
					this.model.getProperty("/serviceInstanceAccessPolicyEncryptionApi")
				);
				this.byId("multiTenancyModeSelect").setSelectedKey(
					this.model.getProperty("/serviceInstanceMultiTenancyMode")
				);
				this.byId("encryptionKeysSelect").setSelectedKey(
					this.model.getProperty("/serviceInstanceEncryptionKeys")
				);
				this.byId("encryptionLevelSelect").setSelectedKey(
					this.model.getProperty("/serviceInstanceEncryptionLevel")
				);
			},

			onPressCancelConfiguration: function() {
				var edit = this.byId("editSubSection");
				edit.setVisible(false);

				var encryptionLevelSelect = this.byId("encryptionLevelSelect");
				encryptionLevelSelect.setValueState();
				encryptionLevelSelect.setValueStateText();

				var bindingValidityInput = this.byId("editBindingValidityInput");
				bindingValidityInput.setValueState();
				bindingValidityInput.setValueStateText();

				var info = this.byId("infoSubSection");
				info.setVisible(true);
			},

			checkEncryptionSettings: function() {
				var encryptionKeysSelect = this.byId("encryptionKeysSelect");
				var encryptionLevelSelect = this.byId("encryptionLevelSelect");
				var multiTenancyModeSelect = this.byId("multiTenancyModeSelect");
				var saveButton = this.byId("save");

				if (this.isSapEncryptionKeysWithWrongEncryptionLevel(encryptionKeysSelect, encryptionLevelSelect)) {
					encryptionLevelSelect.setValueState("Error");
					encryptionLevelSelect.setValueStateText(
						Messages.getText("CredentialStore_MessageWrongEncryptionSettingsSAPManagedError_XMSG")
					);
					saveButton.setEnabled(false);
				} else if (
					this.isCustomerEncryptionKeysWithWrongEncryptionLevelAndPlatformMtm(
						encryptionKeysSelect,
						encryptionLevelSelect,
						multiTenancyModeSelect
					)
				) {
					encryptionLevelSelect.setValueState("Error");
					encryptionLevelSelect.setValueStateText(
						Messages.getText("CredentialStore_MessageWrongEncryptionSettingsPlatformError_XMSG")
					);
					saveButton.setEnabled(false);
				} else if (
					this.isCustomerEncryptionKeysWithWrongEncryptionLevelAndApplicationMtm(
						encryptionKeysSelect,
						encryptionLevelSelect,
						multiTenancyModeSelect
					)
				) {
					encryptionLevelSelect.setValueState("Error");
					encryptionLevelSelect.setValueStateText(
						Messages.getText("CredentialStore_MessageWrongEncryptionSettingsApplicationError_XMSG")
					);
					saveButton.setEnabled(false);
				} else {
					encryptionLevelSelect.setValueState();
					encryptionLevelSelect.setValueStateText();
					saveButton.setEnabled(true);
				}
			},

			bindingValidityChange: function(oEvent) {
				var bindingValidityValue = oEvent.getParameter("value");
				if (bindingValidityValue === "") {
					this.model.setProperty("/bindingValidityChangeError", undefined);
					this.byId("save").setEnabled(true);
				} else if (isNaN(bindingValidityValue)) {
					this.model.setProperty(
						"/bindingValidityChangeError",
						Messages.getText("CredentialStore_ErrorInvalidCharacterInBindingValidity_YMSG")
					);
					this.byId("save").setEnabled(false);
				} else if (bindingValidityValue < 1) {
					this.model.setProperty(
						"/bindingValidityChangeError",
						Messages.getText("CredentialStore_ErrorInvalidValueInBindingValidity_YMSG")
					);
					this.byId("save").setEnabled(false);
				} else {
					this.model.setProperty("/bindingValidityChangeError", undefined);
					this.byId("save").setEnabled(true);
				}
			},

			isSapEncryptionKeysWithWrongEncryptionLevel: function(encryptionKeysSelect, encryptionLevelSelect) {
				return (
					encryptionLevelSelect.getSelectedKey() !== Constants.INSTANCE_ENCRYPTION_LEVEL &&
					encryptionKeysSelect.getSelectedKey() === Constants.SAP_ENCRYPTION_KEYS
				);
			},

			isCustomerEncryptionKeysWithWrongEncryptionLevelAndPlatformMtm: function(
				encryptionKeysSelect,
				encryptionLevelSelect,
				multiTenancyModeSelect
			) {
				return (
					encryptionLevelSelect.getSelectedKey() !== Constants.NAMESPACE_ENCRYPTION_LEVEL &&
					encryptionKeysSelect.getSelectedKey() === Constants.CUSTOMER_ENCRYPTION_KEYS &&
					multiTenancyModeSelect.getSelectedKey() !== Constants.APPLICATION_MULTI_TENANCY_MODE
				);
			},

			isCustomerEncryptionKeysWithWrongEncryptionLevelAndApplicationMtm: function(
				encryptionKeysSelect,
				encryptionLevelSelect,
				multiTenancyModeSelect
			) {
				return (
					encryptionLevelSelect.getSelectedKey() === Constants.NAMESPACE_ENCRYPTION_LEVEL &&
					encryptionKeysSelect.getSelectedKey() === Constants.CUSTOMER_ENCRYPTION_KEYS &&
					multiTenancyModeSelect.getSelectedKey() === Constants.APPLICATION_MULTI_TENANCY_MODE
				);
			},

			formatAuthenticationType: function(authenticationType) {
				if (authenticationType === undefined) {
					return Messages.getText("View_NA_XFLD");
				}
				return AuthenticationTypeFormatter.getAuthenticationTypeDisplayText(authenticationType);
			},

			formatPayloadEncryption: function(payloadEncryption) {
				if (payloadEncryption === undefined) {
					return Messages.getText("View_NA_XFLD");
				}
				return CredstoreUtils.formatStatus(payloadEncryption);
			},

			formatAccessPolicy: function(accessPolicy) {
				return AccessPolicyFormatter.getAccessPolicyDisplayText(accessPolicy);
			},

			formatMultiTenancyMode: function(multiTenancyMode) {
				return MultiTenancyModeFormatter.getMultiTenancyModeDisplayText(multiTenancyMode);
			},

			formatEncryptionKeys: function(encryptionKeys) {
				return EncryptionKeysFormatter.getEncryptionKeysDisplayText(encryptionKeys);
			},

			formatEncryptionLevel: function(encryptionLevel) {
				return EncryptionLevelFormatter.getEncryptionLevelDisplayText(encryptionLevel);
			},

			formatTokenApiAccessPolicySelectEnabled: function(accessPolicy) {
				this.byId("tokenApiSelect").setEnabled(true);
				CredstoreUtils.accessPolicySelectEnable(accessPolicy, this.byId("tokenApiSelect"));
			},

			formatCredsApiAccessPolicySelectEnabled: function(accessPolicy) {
				this.byId("credsApiSelect").setEnabled(true);
				CredstoreUtils.accessPolicySelectEnable(accessPolicy, this.byId("credsApiSelect"));
			},

			formatEncryptionApiAccessPolicySelectEnabled: function(accessPolicy) {
				this.byId("encryptionApiSelect").setEnabled(true);
				CredstoreUtils.accessPolicySelectEnable(accessPolicy, this.byId("encryptionApiSelect"));
			},

			formatBindingType: function(bindingType) {
				return BindingTypeFormatter.getBindingTypeDisplayText(bindingType);
			},

			clearErrorMessage: function(requestType) {
				delete this.errorMessages[requestType];
				this.refreshErrorMessages();
			},

			appendErrorMessage: function(message, requestType) {
				this.errorMessages[requestType] = message;
				this.refreshErrorMessages();
			},

			refreshErrorMessages: function() {
				var messages = Object.keys(this.errorMessages).map(function(key) {
					return this.errorMessages[key];
				}, this);
				this.byId("credentialStoreObjectPage").setErrorMessage(messages.join(". "));
			},

			editToolbarEnabled: function(plan) {
				return plan !== Constants.PROXY_PLAN && plan !== undefined;
			},

			editSettingsVisible: function(plan) {
				return (
					plan !== Constants.PROXY_PLAN &&
					plan !== Constants.TRIAL_PLAN &&
					plan !== Constants.FREE_PLAN &&
					plan !== Constants.STANDARD_PLAN &&
					plan !== undefined
				);
			},

			subscribeEvent: function(requestType) {
				sap.ui
					.getCore()
					.getEventBus()
					.subscribe(
						Constants.CREDENTIAL_STORE_VIEW,
						requestType,
						this.getRequestTypeContextCallback(requestType),
						this
					);
			},

			unsubscribeEvent: function(requestType) {
				sap.ui
					.getCore()
					.getEventBus()
					.unsubscribe(
						Constants.CREDENTIAL_STORE_VIEW,
						requestType,
						this.getRequestTypeContextCallback(requestType),
						this
					);
			},

			getRequestTypeContextCallback: function(requestType) {
				var controller = this;
				switch (requestType) {
					case Constants.PASSWORD:
					case Constants.KEY:
					case Constants.KEYRING:
					case Constants.FILE:
						return function() {
							controller.getInstancePromise();
							controller.getNamespacesPromise();
						};
					case Constants.SHARE:
						return function() {
							controller.getInstancePromise();
						};
				}
			},

			isServicePlanAvailable: function(serviceInstancePlan) {
				return Boolean(serviceInstancePlan);
			},

			isServicePlanMissing: function(serviceInstancePlan) {
				return !this.isServicePlanAvailable(serviceInstancePlan);
			},

			isRestrictedPlan: function(serviceInstancePlan) {
				return (
					serviceInstancePlan === Constants.STANDARD_PLAN ||
					serviceInstancePlan === Constants.TRIAL_PLAN ||
					serviceInstancePlan === Constants.FREE_PLAN
				);
			},

			isNotRestrictedPlan: function(serviceInstancePlan) {
				return !this.isRestrictedPlan(serviceInstancePlan);
			},

			isProxyPlan: function() {
				return this.model.getProperty("/serviceInstancePlan") === Constants.PROXY_PLAN;
			},

			isFileOptionVisible(model) {
				var serviceInstancePlan = this.model.getProperty("/serviceInstancePlan");
				model.setProperty("/filesOptionVisibile", false);
				if (serviceInstancePlan === Constants.PROXY_PLAN) {
					var filesPromise;
					var namespaceName = this.model.getProperty("/firstNamespaceName");
					if (namespaceName !== undefined) {
						filesPromise = this.tryToLoadFilesForNamespace(namespaceName);
					} else {
						filesPromise = this.tryToLoadFilesForNamespace("namespace");
					}

					filesPromise
						.done(function() {
							model.setProperty("/filesOptionVisibile", true);
						})
						.fail(function() {
							model.setProperty("/filesOptionVisibile", false);
						});
				} else if (this.isNotRestrictedPlan(serviceInstancePlan)) {
					model.setProperty("/filesOptionVisibile", true);
				} else {
					model.setProperty("/filesOptionVisibile", false);
				}
			},

			tryToLoadFilesForNamespace: function(namespaceName) {
				var serviceInstanceId = this.getServiceInstanceId();
				return CredstoreService.getNamespaceCredentialsPromise(
					serviceInstanceId,
					namespaceName,
					Constants.FILE
				);
			},

			filterByType: function(type, serviceKeys, bindings, apps) {
				if (type === "application") {
					serviceKeys.forEach(key => {
						bindings.forEach(binding => {
							if (binding.id === key.guid) {
								var index = bindings.indexOf(binding);
								bindings.splice(index, 1);
							}
						});
					});
				} else if (type === "service_key") {
					apps.forEach(app => {
						bindings.forEach(binding => {
							if (binding.applicationId === app.guid) {
								var index = bindings.indexOf(binding);
								bindings.splice(index, 1);
							}
						});
					});
				}
			},

			filterByAppName: function(searchInputValue, filterByName, apps, bindings, serviceKeys) {
				if (!CredstoreUtils.isBindingSearchInputEmpty(searchInputValue) && filterByName === true) {
					apps.forEach(app => {
						bindings.forEach(binding => {
							if (binding.applicationId === app.guid && app.name !== searchInputValue) {
								var index = bindings.indexOf(binding);
								bindings.splice(index, 1);
							}
						});
					});

					serviceKeys.forEach(key => {
						bindings.forEach(binding => {
							if (binding.id === key.guid && key.name !== searchInputValue) {
								var index = bindings.indexOf(binding);
								bindings.splice(index, 1);
							}
						});
					});
				}
			}
		});
	},
	/* export= */
	true
);