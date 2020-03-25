import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from "@angular/core";
import { webSocket, WebSocketSubject } from 'rxjs/webSocket';
import { Observable, Subscription } from 'rxjs';
import { GoogleAnalyticsService } from '../../services/google-analytics.service';

interface IOU {
    currency: string,
    amount: string
}

@Component({
    selector: "iouList",
    templateUrl: "iouList.html",
    styleUrls: ['./iouList.css']
})
export class IouList implements OnInit, OnDestroy {

    @Input()
    issuerAccountChanged: Observable<string>;

    @Input()
    testMode: boolean;

    @Output()
    issuerCurrencySelected: EventEmitter<any> = new EventEmitter();
    
    websocket: WebSocketSubject<any>;
    iouList:IOU[] = [];
    displayedColumns: string[] = ['currency', 'amount'];
    loading:boolean = false;
    originalTestModeValue:boolean;
    escrowClicked:boolean = false;

    private escrowAccountChangedSubscription: Subscription;

    constructor(private googleAnalytics: GoogleAnalyticsService) {}

    ngOnInit() {
        this.escrowAccountChangedSubscription = this.issuerAccountChanged.subscribe(xrplAccount => {
            //console.log("escrow account changed received: " + xrplAccount);
            //console.log("test mode: " + this.testMode);
            if(xrplAccount)
                this.loadIOUList(xrplAccount);
            else
                this.iouList = [];
        });
    }

    ngOnDestroy() {
        if(this.escrowAccountChangedSubscription)
          this.escrowAccountChangedSubscription.unsubscribe();

        if(this.websocket) {
            this.websocket.unsubscribe();
            this.websocket.complete();
        }
    }

    setupWebsocket() {
        this.originalTestModeValue = this.testMode;
        //console.log("connecting websocket");
        this.websocket = webSocket(this.testMode ? 'wss://testnet.xrpl-labs.com' : 'wss://s1.ripple.com');

        this.websocket.asObservable().subscribe(async message => {
            //console.log("websocket message: " + JSON.stringify(message));
            if(message.status && message.status === 'success' && message.type && message.type === 'response' && message.result && message.result.obligations) {
                let obligations:any = message.result.obligations;
                
                if(obligations) {
                    for (var currency in obligations) {
                        if (obligations.hasOwnProperty(currency)) {
                            this.iouList.push({currency: currency, amount: obligations[currency]});
                        }
                    }

                    this.iouList = this.iouList.sort((iouA, iouB) => iouA.currency.localeCompare(iouB.currency));
                }
            
                //if data 0 (no available escrows) -> show message "no escrows available"
                if(this.iouList && this.iouList.length == 0)
                    this.iouList = null;
                    
                console.log(JSON.stringify(this.iouList));
                this.loading = false;
            } else {                
              this.iouList = null;
              this.loading = false;
            }
        });
    }

    loadIOUList(xrplAccount: string) {
        this.googleAnalytics.analyticsEventEmitter('load_iou_list', 'iou_list', 'iou_list_component');

        if(this.websocket && this.originalTestModeValue != this.testMode) {
            this.websocket.unsubscribe();
            this.websocket.complete();
            this.websocket = null;
        }

        if(!this.websocket || this.websocket.closed)
            this.setupWebsocket();

        if(xrplAccount) {
            this.loading = true;

            let gateway_balances_request:any = {
              command: "gateway_balances",
              account: xrplAccount,
              ledger_index: "validated",
            }
      
            this.websocket.next(gateway_balances_request);
        }
    }

    iouSelected(iou: any) {
        this.googleAnalytics.analyticsEventEmitter('escrow_list_selected', 'escrow_list', 'escrow_list_component');
        //console.log("escrow selected: " + JSON.stringify(escrow));
        this.issuerCurrencySelected.emit(iou)
    }
}