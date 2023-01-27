/*!
 * @license
 * Copyright 2019 Alfresco Software, Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { AlfrescoApiService, LogService, UserPreferencesService } from '@alfresco/adf-core';
import { EventEmitter, Injectable, Output } from '@angular/core';
import { from, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import {
    RequestQuery,
    RequestSortDefinitionInner,
    ResultSetPaging,
    SearchApi,
    TagBody,
    TagEntry,
    TagPaging,
    TagsApi
} from '@alfresco/js-api';

@Injectable({
    providedIn: 'root'
})
// eslint-disable-next-line @angular-eslint/directive-class-suffix
export class TagService {

    _tagsApi: TagsApi;
    get tagsApi(): TagsApi {
        this._tagsApi = this._tagsApi ?? new TagsApi(this.apiService.getInstance());
        return this._tagsApi;
    }

    private searchApi: SearchApi = new SearchApi(this.apiService.getInstance());

    /** Emitted when tag information is updated. */
    @Output()
    refresh = new EventEmitter();

    constructor(private apiService: AlfrescoApiService,
                private logService: LogService,
                private userPreferencesService: UserPreferencesService) {
    }

    /**
     * Gets a list of tags added to a node.
     *
     * @param nodeId ID of the target node
     * @returns TagPaging object (defined in JS-API) containing the tags
     */
    getTagsByNodeId(nodeId: string): Observable<TagPaging> {
        return from(this.tagsApi.listTagsForNode(nodeId)).pipe(
            catchError((err) => this.handleError(err))
        );
    }

    /**
     * Gets a list of all the tags already defined in the repository.
     *
     * @param opts Options supported by JS-API
     * @returns TagPaging object (defined in JS-API) containing the tags
     */
    getAllTheTags(opts?: any): Observable<TagPaging> {
        return from(this.tagsApi.listTags(opts))
            .pipe(catchError((err) => this.handleError(err)));
    }

    /**
     * Adds a tag to a node.
     *
     * @param nodeId ID of the target node
     * @param tagName Name of the tag to add
     * @returns TagEntry object (defined in JS-API) with details of the new tag
     */
    addTag(nodeId: string, tagName: string): Observable<TagEntry> {
        const tagBody = new TagBody();
        tagBody.tag = tagName;

        const observableAdd = from(this.tagsApi.createTagForNode(nodeId, [tagBody]));

        observableAdd.subscribe((tagEntry: TagEntry) => {
            this.refresh.emit(tagEntry);
        }, (err) => {
            this.handleError(err);
        });

        return observableAdd;
    }

    /**
     * Removes a tag from a node.
     *
     * @param nodeId ID of the target node
     * @param tag Name of the tag to remove
     * @returns Null object when the operation completes
     */
    removeTag(nodeId: string, tag: string): Observable<any> {
        const observableRemove = from(this.tagsApi.deleteTagFromNode(nodeId, tag));

        observableRemove.subscribe((data) => {
            this.refresh.emit(data);
        }, (err) => {
            this.handleError(err);
        });

        return observableRemove;
    }

    /**
     * Creates tags.
     *
     * @param tags list of tags to create.
     * @returns Created tags.
     */
    createTags(tags: TagBody[]): Observable<TagEntry[]> {
        const observableAdd$: Observable<TagEntry[]> = from(this.tagsApi.createTags(tags));
        observableAdd$.subscribe(
            (tagsEntries: TagEntry[]) => this.refresh.emit(tagsEntries),
            (err) => this.handleError(err)
        );
        return observableAdd$;
    }

    /**
     * Update a tag
     *
     * @param tagId The identifier of a tag.
     * @param tagBody The updated tag.
     * @returns Updated tag.
     */
    updateTag(tagId: string, tagBody: TagBody): Observable<TagEntry> {
        const observableUpdate$: Observable<TagEntry> = from(this.tagsApi.updateTag(tagId, tagBody));
        observableUpdate$.subscribe(
            (tagEntry: TagEntry) => this.refresh.emit(tagEntry),
            (err) => this.handleError(err)
        );
        return observableUpdate$;
    }

    /**
     * Find tags which name contains searched name.
     *
     * @param name Value for name which should be used during searching tags.
     * @param skipCount Specify how many first results should be skipped. Default 0.
     * @param maxItems Specify max number of returned tags. Default is specified by UserPreferencesService.
     * @returns Found tags which name contains searched name.
     */
    searchTags(name: string, skipCount: number = 0, maxItems: number = this.userPreferencesService.paginationSize): Observable<ResultSetPaging> {
        const sortingByName: RequestSortDefinitionInner = new RequestSortDefinitionInner();
        sortingByName.field = 'cm:name';
        sortingByName.ascending = true;
        sortingByName.type = RequestSortDefinitionInner.TypeEnum.FIELD;
        return from(this.searchApi.search({
            query: {
                language: RequestQuery.LanguageEnum.Afts,
                query: `PATH:"/cm:categoryRoot/cm:taggable/*" AND cm:name:"${name}*"`
            },
            paging: {
                skipCount,
                maxItems
            },
            sort: [sortingByName]
        })).pipe(catchError((error) => this.handleError(error)));
    }

    private handleError(error: any) {
        this.logService.error(error);
        return throwError(error || 'Server error');
    }
}
