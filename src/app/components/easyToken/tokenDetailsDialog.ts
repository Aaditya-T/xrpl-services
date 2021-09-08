import { Component, OnInit, Inject } from "@angular/core";
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { LocalStorageService } from 'angular-2-local-storage';
import { OverlayContainer } from '@angular/cdk/overlay';
import { TokenIssuer } from '../../utils/types'
import { XRPLWebsocket } from "src/app/services/xrplWebSocket";
import * as normalizer from "../../utils/normalizers";
import * as flagUtils from "../../utils/flagutils";
import { CheckLiquidityClass } from "../../services/xrpllabs-liquidity-check/checkLiquidityForToken";
import { AppService } from '../../services/app.service';

@Component({
    selector: "tokenDetailsDialog",
    templateUrl: "tokenDetailsDialog.html",
    styleUrls: ['./tokenDetailsDialog.scss']
})
export class TokenDetailsDialog implements OnInit {

    isDarkTheme:boolean = false;

    accountData:any = null;
    signerList:any = null;

    private checkLiquidity:CheckLiquidityClass;

    creationDate:any = null;

    constructor(
        private app: AppService,
        private xrplWebSocket: XRPLWebsocket,
        public dialogRef: MatDialogRef<TokenDetailsDialog>,
        @Inject(MAT_DIALOG_DATA) public tokenIssuer: TokenIssuer,
        private localStorage: LocalStorageService,
        private overlayContainer: OverlayContainer) {
        }

    async ngOnInit() {
        this.checkLiquidity = CheckLiquidityClass.Instance;

        if(this.localStorage && !this.localStorage.get("darkMode")) {
            this.overlayContainer.getContainerElement().classList.remove('dark-theme');
            this.overlayContainer.getContainerElement().classList.add('light-theme');
        } else {
            this.overlayContainer.getContainerElement().classList.remove('light-theme');
            this.overlayContainer.getContainerElement().classList.add('dark-theme');
        }        

        window.scrollTo(0,0);

        //load issuer data
        let account_info_request:any = {
            command: "account_info",
            account: this.tokenIssuer.account,
            strict: true,
            signer_lists: true
        }

        let promises:any[] = [];
        promises.push(this.xrplWebSocket.getWebsocketMessage("token-information", account_info_request, false));
        promises.push(this.app.get('https://xrpldata.com/api/v1/tokencreation?issuer='+this.tokenIssuer.account+"&currency="+normalizer.getCurrencyCodeForXRPL(this.tokenIssuer.currency)))
    
        let results:any[] = await Promise.all(promises)

        let message_acc_info:any = results[0];
        //console.log("token-information account info: " + JSON.stringify(message_acc_info));
    
        if(message_acc_info && message_acc_info.status && message_acc_info.type && message_acc_info.type === 'response') {
            if(message_acc_info.status === 'success' && message_acc_info.result && message_acc_info.result.account_data) {
              this.accountData = message_acc_info.result.account_data;
              if(message_acc_info.result.signer_lists)
                this.signerList = message_acc_info.result.signer_lists;
            } else {
                this.accountData = null;
                this.signerList = null;
            }
        } else {
            this.accountData = null;
            this.signerList = null;
        }

        //await this.checkLiquidity.checkLiquidity(this.tokenIssuer.account, this.tokenIssuer.currency);

        this.creationDate = results[1];
        //console.log("token creation date: " + this.creationDate.date);
    }

    getDomainFromXrplAccount(): string {
        if(this.accountData && this.accountData.Domain)
            return Buffer.from(this.accountData.Domain, 'hex').toString('utf8');
        else
            return null;
    }

    addMissingHttpsIfMissing(domain:string) {
        if(!domain.startsWith("http"))
            return "https://"+domain;
        else
            return domain;
    }

    getExplorerLink(): string {
        if(this.tokenIssuer && this.tokenIssuer.resolvedBy) {
            if(this.tokenIssuer.resolvedBy.toUpperCase() === "XRPSCAN")
                return "https://xrpscan.com/account/"+this.tokenIssuer.account;
            else
                return "https://bithomp.com/explorer/"+this.tokenIssuer.account;
        }
    }

    accountIsBlackholed(): boolean {
        if(this.accountData && !this.signerList && this.accountData.RegularKey && flagUtils.isMasterKeyDisabled(this.accountData.Flags)) {
            return this.accountData.RegularKey === 'rrrrrrrrrrrrrrrrrrrrrhoLvTp' || this.accountData.RegularKey === 'rrrrrrrrrrrrrrrrrrrrBZbvji' || this.accountData.RegularKey === 'rrrrrrrrrrrrrrrrrNAMEtxvNvQ' || this.accountData.RegularKey === 'rrrrrrrrrrrrrrrrrrrn5RM1rHd';
        } else {
            return false;
        }
    }

    getCurrencyCodeAsHex() {
        return normalizer.getCurrencyCodeForXRPL(this.tokenIssuer.currency)
    }

    getTokenCreation(): string {
        if(this.creationDate)
            return new Date(this.creationDate.date).toLocaleString();
        else
            return "-";
    }

    closeIt() {
        this.dialogRef.close(null);
    }
}